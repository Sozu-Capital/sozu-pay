import "server-only";

import {
  Asset,
  Keypair,
  Networks,
  Operation,
  TransactionBuilder,
} from "@stellar/stellar-sdk";
import type { Horizon } from "@stellar/stellar-sdk";
import { fundClassicAccount } from "@/lib/stellar/fund";
import { getHorizon } from "@/lib/stellar/server";
import { sealStellarSecret } from "@/lib/stellar/passkey-export";

const USDC_ISSUER_TESTNET = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";
const USDC_ISSUER_PUBLIC = "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4EZN";
const STARTING_XLM = "2";

function networkPassphrase(): string {
  return process.env.STELLAR_NETWORK === "public" ? Networks.PUBLIC : Networks.TESTNET;
}

function usdcIssuer(): string {
  return process.env.STELLAR_NETWORK === "public" ? USDC_ISSUER_PUBLIC : USDC_ISSUER_TESTNET;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function loadAccount(horizon: Horizon.Server, publicKey: string): Promise<Horizon.AccountResponse | null> {
  try {
    return await horizon.loadAccount(publicKey);
  } catch {
    return null;
  }
}

export function accountHasUsdcTrustline(account: Horizon.AccountResponse, issuer = usdcIssuer()): boolean {
  return account.balances.some(
    (balance) =>
      balance.asset_type !== "native" &&
      "asset_code" in balance &&
      balance.asset_code === "USDC" &&
      balance.asset_issuer === issuer,
  );
}

async function waitForAccount(horizon: Horizon.Server, publicKey: string): Promise<Horizon.AccountResponse> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const account = await loadAccount(horizon, publicKey);
    if (account) return account;
    await sleep(1000);
  }
  throw new Error("Account was funded but Horizon has not seen it yet.");
}

async function submitUsdcTrustline(horizon: Horizon.Server, keypair: Keypair): Promise<void> {
  const account = await waitForAccount(horizon, keypair.publicKey());
  if (accountHasUsdcTrustline(account)) return;
  const transaction = new TransactionBuilder(account, {
    fee: "100",
    networkPassphrase: networkPassphrase(),
  })
    .addOperation(
      Operation.changeTrust({
        asset: new Asset("USDC", usdcIssuer()),
        limit: "1000000000",
      }),
    )
    .setTimeout(180)
    .build();
  transaction.sign(keypair);
  const result = await horizon.submitTransaction(transaction);
  if (!result.successful) {
    throw new Error("USDC trustline was rejected.");
  }
}

export async function receiveAccountStatus(publicKey: string | null | undefined): Promise<"ready" | "missing"> {
  const address = publicKey?.trim();
  if (!address?.startsWith("G")) return "missing";
  const account = await loadAccount(getHorizon(), address);
  if (!account || !accountHasUsdcTrustline(account)) return "missing";
  return "ready";
}

/**
 * Create a classic account, fund it with 2 XLM, and open the Circle USDC trustline.
 * The secret is returned only inside the sealed blob. Callers must not persist it.
 */
export async function createSealedReceiveAccount(prf: Uint8Array): Promise<{ publicKey: string; blob: string }> {
  const keypair = Keypair.random();
  const publicKey = keypair.publicKey();
  await fundClassicAccount(publicKey, STARTING_XLM);
  await submitUsdcTrustline(getHorizon(), keypair);
  const blob = await sealStellarSecret(keypair.secret(), prf);
  return { publicKey, blob };
}
