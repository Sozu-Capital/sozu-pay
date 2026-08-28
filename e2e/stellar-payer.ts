import {
  Asset,
  Horizon,
  Keypair,
  Networks,
  Operation,
  TransactionBuilder,
} from "@stellar/stellar-sdk";
import { solveSozuFaucetPow, SOZU_FAUCET_POW_PREFIX } from "../src/lib/faucet/pow";

export const CIRCLE_USDC_TESTNET_ISSUER =
  "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";

const HORIZON_URL = "https://horizon-testnet.stellar.org";
const FRIENDBOT_URL = "https://friendbot.stellar.org";
const FAUCET_URL = (process.env.SOZU_FAUCET_URL ?? "https://faucet.sozu.capital").replace(
  /\/$/,
  "",
);

const horizon = new Horizon.Server(HORIZON_URL);
const usdc = new Asset("USDC", CIRCLE_USDC_TESTNET_ISSUER);

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function friendbot(publicKey: string) {
  const res = await fetch(`${FRIENDBOT_URL}/?addr=${encodeURIComponent(publicKey)}`);
  if (!res.ok && res.status !== 400) {
    throw new Error(`Friendbot failed: ${res.status}`);
  }
  await sleep(2000);
}

async function ensureUsdcTrustline(payer: Keypair) {
  const account = await horizon.loadAccount(payer.publicKey());
  const hasTrust = account.balances.some(
    (b) =>
      b.asset_type === "credit_alphanum4" &&
      b.asset_code === "USDC" &&
      "asset_issuer" in b &&
      b.asset_issuer === CIRCLE_USDC_TESTNET_ISSUER,
  );
  if (hasTrust) return;
  const tx = new TransactionBuilder(account, {
    fee: "100000",
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(Operation.changeTrust({ asset: usdc, limit: "1000000000" }))
    .setTimeout(60)
    .build();
  tx.sign(payer);
  const result = await horizon.submitTransaction(tx);
  if (!result.successful) {
    throw new Error("USDC trustline submit failed");
  }
  await sleep(1500);
}

async function claimFaucetUsdc(to: string) {
  const challengeRes = await fetch(`${FAUCET_URL}/api/v1/faucet/pow/challenge`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ to }),
  });
  const challenge = (await challengeRes.json()) as {
    challengeId?: string;
    to?: string;
    difficulty?: number;
    prefix?: string;
    error?: string;
    reason?: string;
  };
  if (!challengeRes.ok) {
    throw new Error(challenge.error ?? `Faucet challenge failed (${challengeRes.status})`);
  }
  const challengeId = String(challenge.challengeId ?? "");
  const challengeTo = String(challenge.to ?? to).toUpperCase();
  const difficulty = Number(challenge.difficulty);
  const nonce = solveSozuFaucetPow({
    prefix:
      typeof challenge.prefix === "string" && challenge.prefix
        ? challenge.prefix
        : SOZU_FAUCET_POW_PREFIX,
    challengeId,
    to: challengeTo,
    difficulty,
  });
  const claimRes = await fetch(`${FAUCET_URL}/api/v1/faucet/claim`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ to: challengeTo, pow: { challengeId, nonce } }),
  });
  const claim = (await claimRes.json()) as {
    success?: boolean;
    error?: string;
    reason?: string;
    txHash?: string;
  };
  if (!claimRes.ok || claim.success !== true) {
    throw new Error(claim.error ?? `Faucet claim failed (${claimRes.status})`);
  }
  await sleep(2000);
}

export async function fundTestnetPayer(): Promise<Keypair> {
  const payer = Keypair.random();
  await friendbot(payer.publicKey());
  await ensureUsdcTrustline(payer);
  await claimFaucetUsdc(payer.publicKey());
  return payer;
}

export async function sendTestnetUsdc(params: {
  payer: Keypair;
  destination: string;
  amount: string;
}): Promise<string> {
  const account = await horizon.loadAccount(params.payer.publicKey());
  const tx = new TransactionBuilder(account, {
    fee: "100000",
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(
      Operation.payment({
        destination: params.destination,
        asset: usdc,
        amount: params.amount,
      }),
    )
    .setTimeout(60)
    .build();
  tx.sign(params.payer);
  const result = await horizon.submitTransaction(tx);
  if (!result.successful || !result.hash) {
    throw new Error("USDC payment submit failed");
  }
  return result.hash;
}
