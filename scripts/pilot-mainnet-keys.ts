/**
 * Mainnet keys for the Mujeres 2000 pilot (szp #89). Run locally, never in CI.
 *
 *   npx tsx scripts/pilot-mainnet-keys.ts generate --keys ~/Secure/sozu-pilot-keys.json
 *   npx tsx scripts/pilot-mainnet-keys.ts setup    --keys ~/Secure/sozu-pilot-keys.json
 *   npx tsx scripts/pilot-mainnet-keys.ts verify   --keys ~/Secure/sozu-pilot-keys.json [--forbid G…]
 *
 * generate: offline. Writes four new keypairs (mode 600) outside any repo; prints public keys only.
 * activate: Create Account from a funded wallet (Decaf) into one role. Decaf's send screen
 *           cannot do this: a Payment to an address that is not on the ledger is rejected.
 *           Source secret is FUND_SOURCE_SECRET in the shell, never an argument.
 *           Dry run unless --yes. Start with --xlm 2, return it, then send the rest.
 * return:   pays XLM from a role back to an existing address, leaving the 1 XLM reserve.
 *           Dry run unless --yes. Does not merge the account.
 * setup:    adds the USDC trustline to every role that needs one, once that account holds XLM.
 * verify:   checks balances, trustlines, and that no key reuses one from a local .env.local.
 *           Prints the address table for the roadmap. Exits 1 if any check fails.
 *
 * Secrets never go to stdout. Copy them from the keys file into the password manager and the
 * Vercel production env listed by `verify`, then move the file somewhere offline.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { Asset, Horizon, Keypair, Networks, Operation, TransactionBuilder } from "@stellar/stellar-sdk";
import {
  assertKeysFileOutsideRepo,
  checkAccount,
  findReusedKeys,
  MAINNET_HORIZON_URL,
  MAINNET_USDC_ISSUER,
  maxWithdrawableXlm,
  parseKeysFile,
  PILOT_KEY_SPECS,
  renderAddressTable,
  type AccountSnapshot,
  type PilotKeyRole,
  type PilotKeysFile,
} from "../src/lib/pilot/mainnet-keys";

const REPO_ROOT = path.resolve(__dirname, "..");
const SIBLING_REPOS = ["sozu-pay", "sozu-wallet", "sozu-faucet"].map((r) => path.resolve(REPO_ROOT, "..", r));
const USDC = new Asset("USDC", MAINNET_USDC_ISSUER);
const horizon = new Horizon.Server(MAINNET_HORIZON_URL);

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
}

function flag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function xlmString(amount: number): string {
  const stroops = Math.round(amount * 1e7);
  return `${Math.trunc(stroops / 1e7)}.${String(Math.abs(stroops % 1e7)).padStart(7, "0")}`;
}

function sourceKeypair(): Keypair {
  const secret = process.env.FUND_SOURCE_SECRET?.trim();
  if (!secret) {
    throw new Error(
      "Set FUND_SOURCE_SECRET in this shell to the Decaf Stellar secret. Do not pass it as an argument, and do not paste it into chat.",
    );
  }
  try {
    return Keypair.fromSecret(secret);
  } catch {
    throw new Error("FUND_SOURCE_SECRET is not a Stellar secret key.");
  }
}

function roleArg(): PilotKeyRole {
  const role = (arg("role") ?? "fee_payer") as PilotKeyRole;
  if (!PILOT_KEY_SPECS.some((s) => s.role === role)) throw new Error(`Unknown role ${role}.`);
  return role;
}

function args(name: string): string[] {
  return process.argv.flatMap((a, i) => (a === `--${name}` && process.argv[i + 1] ? [process.argv[i + 1]] : []));
}

function keysPath(): string {
  const raw = arg("keys");
  if (!raw) throw new Error("--keys <path outside the repo> is required.");
  const p = path.resolve(raw.replace(/^~(?=$|\/)/, os.homedir()));
  assertKeysFileOutsideRepo(p, SIBLING_REPOS);
  return p;
}

function loadKeys(): PilotKeysFile {
  return parseKeysFile(readFileSync(keysPath(), "utf8"));
}

function generate(): void {
  const file = keysPath();
  if (existsSync(file)) throw new Error(`${file} already exists. Refusing to overwrite mainnet keys.`);
  const keys = Object.fromEntries(
    PILOT_KEY_SPECS.map((s) => {
      const kp = Keypair.random();
      return [s.role, { publicKey: kp.publicKey(), secret: kp.secret() }];
    }),
  ) as PilotKeysFile["keys"];
  const data: PilotKeysFile = { network: "public", createdAt: new Date().toISOString(), keys };
  writeFileSync(file, JSON.stringify(data, null, 2) + "\n", { mode: 0o600, flag: "wx" });
  console.log(`Wrote ${file} (mode 600). Public keys:\n`);
  for (const s of PILOT_KEY_SPECS) {
    console.log(`  ${s.role.padEnd(15)} ${keys[s.role].publicKey}  send ≥ ${s.minXlm} XLM`);
  }
  console.log("\nNext: send that XLM from an exchange to each address, then run `setup`.");
}

async function snapshot(publicKey: string): Promise<AccountSnapshot> {
  try {
    const acct = await horizon.loadAccount(publicKey);
    let xlm = 0;
    let usdc = 0;
    let usdcTrustline = false;
    for (const b of acct.balances) {
      if (b.asset_type === "native") xlm = Number(b.balance);
      else if ("asset_code" in b && b.asset_code === "USDC" && b.asset_issuer === MAINNET_USDC_ISSUER) {
        usdcTrustline = true;
        usdc = Number(b.balance);
      }
    }
    return { exists: true, xlm, usdc, usdcTrustline };
  } catch (e) {
    if ((e as { response?: { status?: number } }).response?.status === 404) return { exists: false };
    throw e;
  }
}

async function activate(): Promise<void> {
  const role = roleArg();
  const xlm = Number(arg("xlm"));
  if (!Number.isFinite(xlm) || xlm < 1) throw new Error("--xlm must be at least 1, the reserve that creates the account.");
  const destination = loadKeys().keys[role].publicKey;
  const sourceKp = sourceKeypair();
  if (await snapshot(destination).then((s) => s.exists)) {
    throw new Error(`${role} already exists at ${destination}. A normal XLM payment can fund it now. Refusing to create it again.`);
  }
  let source;
  try {
    source = await horizon.loadAccount(sourceKp.publicKey());
  } catch (e) {
    if ((e as { response?: { status?: number } }).response?.status === 404) {
      throw new Error(`Source ${sourceKp.publicKey()} is not on mainnet. FUND_SOURCE_SECRET must be the Decaf account that already holds the XLM.`);
    }
    throw e;
  }
  const sourceXlm = Number(source.balances.find((b) => b.asset_type === "native")?.balance ?? 0);
  const fee = await horizon.fetchBaseFee();
  const spendable = maxWithdrawableXlm(sourceXlm, source.subentry_count, Number(fee) / 1e7);
  console.log(`Source ${sourceKp.publicKey()}`);
  console.log(`  balance ${sourceXlm} XLM, can send ${spendable} XLM`);
  console.log(`Create ${role} ${destination} with ${xlm} XLM`);
  if (spendable + 1e-7 < xlm) throw new Error(`Source can send ${spendable} XLM, which is less than ${xlm}.`);
  if (!flag("yes")) {
    console.log("\nDry run. Confirm that source address is the Stellar address shown in Decaf, then rerun the same command with --yes.");
    return;
  }
  const tx = new TransactionBuilder(source, { fee: String(fee), networkPassphrase: Networks.PUBLIC })
    .addOperation(Operation.createAccount({ destination, startingBalance: xlmString(xlm) }))
    .setTimeout(60)
    .build();
  tx.sign(sourceKp);
  const res = await horizon.submitTransaction(tx);
  console.log(`Created. https://stellar.expert/explorer/public/tx/${res.hash}`);
}

async function returnXlm(): Promise<void> {
  const role = roleArg();
  const to = arg("to");
  if (!to?.startsWith("G") || to.length !== 56) throw new Error("--to must be an existing Stellar public address, the Decaf one.");
  const stored = loadKeys().keys[role];
  const kp = Keypair.fromSecret(stored.secret);
  if (kp.publicKey() !== stored.publicKey) throw new Error(`${role} secret does not match its public key. Refusing to sign.`);
  if (to === kp.publicKey()) throw new Error("--to is this same account.");
  const snap = await snapshot(kp.publicKey());
  if (!snap.exists) throw new Error(`${role} is not on mainnet yet.`);
  if (!(await snapshot(to)).exists) throw new Error(`${to} is not on mainnet. Return only to an address that already exists.`);
  const acct = await horizon.loadAccount(kp.publicKey());
  const fee = await horizon.fetchBaseFee();
  const max = maxWithdrawableXlm(snap.xlm, acct.subentry_count, Number(fee) / 1e7);
  const amount = flag("max") ? max : Number(arg("xlm"));
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("Nothing to send. Pass --xlm <amount> or --max. The 1 XLM reserve cannot be paid out.");
  if (amount > max + 1e-7) {
    throw new Error(`Refusing to send ${amount} XLM. The most that leaves the reserve is ${max} XLM.`);
  }
  console.log(`Return ${amount} XLM from ${role} ${kp.publicKey()} to ${to}`);
  console.log(`  ${role} keeps about ${xlmString(snap.xlm - amount)} XLM before the fee`);
  if (!flag("yes")) {
    console.log("\nDry run. Rerun the same command with --yes to submit. This does not delete the account.");
    return;
  }
  const tx = new TransactionBuilder(acct, { fee: String(fee), networkPassphrase: Networks.PUBLIC })
    .addOperation(Operation.payment({ destination: to, asset: Asset.native(), amount: xlmString(amount) }))
    .setTimeout(60)
    .build();
  tx.sign(kp);
  const res = await horizon.submitTransaction(tx);
  console.log(`Sent. https://stellar.expert/explorer/public/tx/${res.hash}`);
}

async function setup(): Promise<void> {
  const { keys } = loadKeys();
  for (const s of PILOT_KEY_SPECS.filter((x) => x.usdcTrustline)) {
    const { publicKey, secret } = keys[s.role];
    const snap = await snapshot(publicKey);
    if (!snap.exists) {
      console.log(`${s.role}: not on mainnet yet. Send ≥ ${s.minXlm} XLM to ${publicKey}, then rerun.`);
      continue;
    }
    if (snap.usdcTrustline) {
      console.log(`${s.role}: USDC trustline already there.`);
      continue;
    }
    const source = await horizon.loadAccount(publicKey);
    const tx = new TransactionBuilder(source, { fee: String(await horizon.fetchBaseFee()), networkPassphrase: Networks.PUBLIC })
      .addOperation(Operation.changeTrust({ asset: USDC }))
      .setTimeout(60)
      .build();
    tx.sign(Keypair.fromSecret(secret));
    const res = await horizon.submitTransaction(tx);
    console.log(`${s.role}: USDC trustline added. https://stellar.expert/explorer/public/tx/${res.hash}`);
  }
}

/** Public keys of every Stellar key in the local env files, so pilot keys can't reuse one. */
function existingAppKeys(): string[] {
  const found: string[] = [];
  for (const repo of SIBLING_REPOS) {
    for (const name of [".env.local", ".env"]) {
      const file = path.join(repo, name);
      if (!existsSync(file)) continue;
      for (const line of readFileSync(file, "utf8").split("\n")) {
        const value = line.match(/^\s*[A-Z0-9_]+\s*=\s*["']?([A-Z0-9]{56})["']?\s*$/)?.[1];
        if (!value) continue;
        if (value.startsWith("G")) found.push(value);
        if (value.startsWith("S")) {
          try {
            found.push(Keypair.fromSecret(value).publicKey());
          } catch {
            /* not a Stellar secret */
          }
        }
      }
    }
  }
  return found;
}

async function verify(): Promise<void> {
  const { keys } = loadKeys();
  const forbidden = [...existingAppKeys(), ...args("forbid")];
  const checks = await Promise.all(
    PILOT_KEY_SPECS.map(async (s) => checkAccount(s, keys[s.role].publicKey, await snapshot(keys[s.role].publicKey))),
  );
  const reuse = findReusedKeys(keys, forbidden);
  console.log(renderAddressTable(checks));
  console.log(`\nChecked against ${forbidden.length} existing keys from local env files.`);
  for (const p of reuse) console.log(`FAIL: ${p}`);

  console.log("\nVercel production env:");
  for (const s of PILOT_KEY_SPECS) {
    if (s.secretEnv) console.log(`  ${s.secretEnv.project}: ${s.secretEnv.name} = <${s.role} secret from the keys file>`);
    if (s.addressEnv) console.log(`  ${s.addressEnv.project}: ${s.addressEnv.name} = ${keys[s.role as PilotKeyRole].publicKey}`);
  }

  if (reuse.length || checks.some((c) => c.problems.length)) process.exit(1);
}

const commands: Record<string, () => void | Promise<void>> = { generate, activate, return: returnXlm, setup, verify };
const run = commands[process.argv[2] ?? ""];
if (!run) {
  console.error("Usage: tsx scripts/pilot-mainnet-keys.ts <generate|activate|return|setup|verify> --keys <file>");
  process.exit(2);
}
Promise.resolve().then(run).catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
