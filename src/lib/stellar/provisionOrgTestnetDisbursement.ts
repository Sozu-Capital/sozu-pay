/**
 * MVP: after an organization is created on Stellar testnet, generate a classic (G)
 * disbursement keypair, fund it via Friendbot, add a USDC trustline, and persist
 * pubkey + server-encrypted secret on the org row (AUTH_SECRET + org_id).
 */
import "server-only";

import {
  Asset,
  Keypair,
  Networks,
  Operation,
  TransactionBuilder,
} from "@stellar/stellar-sdk";
import type { Horizon } from "@stellar/stellar-sdk";
import { encryptOrgSecret } from "@/lib/org-secret";
import { updateOrganizationWallet } from "@/lib/db/organizations";
import { getHorizon } from "./server";

const FRIENDBOT_URL = "https://friendbot.stellar.org";
const USDC_ISSUER_TESTNET =
  "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";
const USDC_ISSUER_PUBLIC =
  "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4EZN";

function isPublicNetwork(): boolean {
  return process.env.STELLAR_NETWORK === "public";
}

function getUsdcIssuer(): string {
  return isPublicNetwork() ? USDC_ISSUER_PUBLIC : USDC_ISSUER_TESTNET;
}

function getNetworkPassphrase(): string {
  return isPublicNetwork() ? Networks.PUBLIC : Networks.TESTNET;
}

function accountHasUsdcTrustline(
  account: Horizon.AccountResponse,
  issuer: string
): boolean {
  return account.balances.some(
    (b) =>
      b.asset_type === "credit_alphanum4" &&
      b.asset_code === "USDC" &&
      (b as { asset_issuer?: string }).asset_issuer === issuer
  );
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function loadAccountOrNull(
  horizon: ReturnType<typeof getHorizon>,
  publicKey: string
): Promise<Horizon.AccountResponse | null> {
  try {
    return await horizon.loadAccount(publicKey);
  } catch {
    return null;
  }
}

async function fundWithFriendbot(publicKey: string): Promise<{
  hash?: string;
  alreadyFunded: boolean;
}> {
  const url = `${FRIENDBOT_URL}/?addr=${encodeURIComponent(publicKey)}`;
  const friendbotResponse = await fetch(url, { method: "GET" });
  if (friendbotResponse.ok) {
    const friendbotData = (await friendbotResponse.json().catch(() => ({}))) as {
      hash?: string;
    };
    return { hash: friendbotData.hash, alreadyFunded: false };
  }
  const errorData = (await friendbotResponse.json().catch(() => ({}))) as {
    detail?: string;
  };
  const detail = String(errorData.detail || "").toLowerCase();
  const alreadyFunded =
    friendbotResponse.status === 400 &&
    (detail.includes("already funded") || detail.includes("starting balance"));
  if (alreadyFunded) {
    return { alreadyFunded: true };
  }
  throw new Error(
    `Friendbot funding failed: ${friendbotResponse.status} ${JSON.stringify(errorData)}`
  );
}

async function submitUsdcTrustlineIfNeeded(
  horizon: ReturnType<typeof getHorizon>,
  keypair: Keypair,
  account: Horizon.AccountResponse
): Promise<string | undefined> {
  const issuer = getUsdcIssuer();
  if (accountHasUsdcTrustline(account, issuer)) {
    return undefined;
  }
  const networkPassphrase = getNetworkPassphrase();
  const usdcAsset = new Asset("USDC", issuer);
  const transaction = new TransactionBuilder(account, {
    fee: "100",
    networkPassphrase,
  })
    .addOperation(
      Operation.changeTrust({
        asset: usdcAsset,
        limit: "1000000000",
      })
    )
    .setTimeout(30)
    .build();

  transaction.sign(keypair);
  const result = await horizon.submitTransaction(transaction);
  if (!result.successful) {
    const codes = (result as { result_codes?: unknown }).result_codes;
    throw new Error(
      codes != null
        ? `USDC trustline tx failed: ${JSON.stringify(codes)}`
        : "USDC trustline tx failed"
    );
  }
  return result.hash;
}

export type ProvisionOrgTestnetDisbursementResult = {
  publicKey: string;
  friendbotHash?: string;
  trustlineHash?: string;
};

/**
 * Testnet-only: create random classic wallet, Friendbot + USDC trustline, store on org.
 * Returns null on public network (caller should not rely on auto-provision there).
 */
export async function provisionOrgTestnetClassicDisbursement(
  orgId: string
): Promise<ProvisionOrgTestnetDisbursementResult | null> {
  if (isPublicNetwork()) {
    return null;
  }

  const horizon = getHorizon();
  const keypair = Keypair.random();
  const publicKey = keypair.publicKey();
  const issuer = getUsdcIssuer();

  let friendbotHash: string | undefined;
  let account = await loadAccountOrNull(horizon, publicKey);

  if (!account) {
    const fb = await fundWithFriendbot(publicKey);
    if (fb.hash) {
      friendbotHash = fb.hash;
    }
    if (!fb.alreadyFunded) {
      await sleep(2000);
    }
    account = await loadAccountOrNull(horizon, publicKey);
    if (!account) {
      throw new Error("Account not found on Horizon after Friendbot funding.");
    }
  }

  if (!accountHasUsdcTrustline(account, issuer)) {
    const trustlineHash = await submitUsdcTrustlineIfNeeded(horizon, keypair, account);
    const encrypted = encryptOrgSecret(orgId, keypair.secret());
    const updated = await updateOrganizationWallet(orgId, publicKey, encrypted);
    if (!updated) {
      throw new Error("Failed to persist organization disbursement wallet.");
    }
    return { publicKey, friendbotHash, trustlineHash };
  }

  const encrypted = encryptOrgSecret(orgId, keypair.secret());
  const updated = await updateOrganizationWallet(orgId, publicKey, encrypted);
  if (!updated) {
    throw new Error("Failed to persist organization disbursement wallet.");
  }
  return { publicKey, friendbotHash };
}
