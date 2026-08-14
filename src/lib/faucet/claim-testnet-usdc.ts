import "server-only";

import { solveSozuFaucetPow, SOZU_FAUCET_POW_PREFIX } from "@/lib/faucet/pow";
import { isFakePollarStaffWallet } from "@/lib/pollar/types";

const DEFAULT_FAUCET_URL = "https://faucet.sozu.capital";
const STELLAR_LAB_TESTNET_FUND_URL =
  "https://lab.stellar.org/account/fund?$=network$id=testnet&label=Testnet&horizonUrl=https:////horizon-testnet.stellar.org&rpcUrl=https:////soroban-testnet.stellar.org&passphrase=Test%20SDF%20Network%20/;%20September%202015";

/** Circle USDC issuer on Stellar testnet (locked in Sozu Faucet). */
export const CIRCLE_USDC_TESTNET_ISSUER =
  "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";

export function getSozuFaucetBaseUrl(): string {
  return (process.env.SOZU_FAUCET_URL ?? DEFAULT_FAUCET_URL).replace(/\/$/, "");
}

export function isStellarTestnet(): boolean {
  return process.env.STELLAR_NETWORK !== "public";
}

export type SozuFaucetClaimResult =
  | {
      ok: true;
      amount: number;
      to: string;
      txHash?: string;
      explorerUrl?: string;
    }
  | {
      ok: false;
      error: string;
      reason?: string;
      helpUrl?: string;
      amount?: number;
    };

async function readJson(res: Response, label: string): Promise<Record<string, unknown>> {
  const text = await res.text();
  const contentType = res.headers.get("content-type") || "";
  if (text && (contentType.includes("json") || text.trimStart().startsWith("{"))) {
    try {
      return JSON.parse(text) as Record<string, unknown>;
    } catch {
      // fall through
    }
  }
  throw new Error(
    `${label} returned HTTP ${res.status} (${contentType || "unknown type"}), not JSON.`,
  );
}

function isStellarAddress(value: string): boolean {
  return /^[CG][A-Z0-9]{55}$/.test(value);
}

/**
 * Equivalent to `npx @sozu/faucet@latest claim <ADDRESS>` —
 * PoW challenge → solve → POST /api/v1/faucet/claim (100 USDC server-fixed).
 */
export async function claimTestnetUsdcViaSozuFaucet(
  destinationRaw: string,
): Promise<SozuFaucetClaimResult> {
  if (!isStellarTestnet()) {
    return { ok: false, error: "Sozu Faucet is testnet-only.", reason: "not_testnet" };
  }

  const to = destinationRaw.trim().toUpperCase();
  if (!isStellarAddress(to) || isFakePollarStaffWallet(to)) {
    return {
      ok: false,
      error: "Need a real Stellar G… or C… treasury address to claim testnet USDC.",
      reason: "invalid_address",
    };
  }

  const url = getSozuFaucetBaseUrl();

  if (to.startsWith("G")) {
    const preflight = await preflightClassicG(to);
    if (preflight) return preflight;
  }

  const challengeRes = await fetch(`${url}/api/v1/faucet/pow/challenge`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ to }),
  });
  const challenge = await readJson(challengeRes, "PoW challenge");
  if (!challengeRes.ok) {
    return {
      ok: false,
      error: String(challenge.error ?? `Challenge failed (${challengeRes.status})`),
      reason: typeof challenge.reason === "string" ? challenge.reason : undefined,
      helpUrl: typeof challenge.helpUrl === "string" ? challenge.helpUrl : undefined,
    };
  }

  const challengeId = String(challenge.challengeId ?? "");
  const challengeTo = String(challenge.to ?? to).toUpperCase();
  const difficulty = Number(challenge.difficulty);
  const prefix =
    typeof challenge.prefix === "string" && challenge.prefix
      ? challenge.prefix
      : SOZU_FAUCET_POW_PREFIX;

  if (!challengeId || !Number.isFinite(difficulty) || difficulty < 1) {
    return { ok: false, error: "Invalid PoW challenge from faucet.", reason: "bad_challenge" };
  }

  const nonce = solveSozuFaucetPow({
    prefix,
    challengeId,
    to: challengeTo,
    difficulty,
  });

  const claimRes = await fetch(`${url}/api/v1/faucet/claim`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      to: challengeTo,
      pow: { challengeId, nonce },
    }),
  });
  const claim = await readJson(claimRes, "Claim");

  if (!claimRes.ok || claim.success !== true) {
    return {
      ok: false,
      error: String(claim.error ?? `Claim failed (${claimRes.status})`),
      reason: typeof claim.reason === "string" ? claim.reason : undefined,
      helpUrl:
        typeof claim.helpUrl === "string"
          ? claim.helpUrl
          : to.startsWith("G")
            ? STELLAR_LAB_TESTNET_FUND_URL
            : undefined,
      amount: typeof claim.amount === "number" ? claim.amount : undefined,
    };
  }

  const amount = typeof claim.amount === "number" ? claim.amount : 100;
  const txHash =
    typeof claim.txHash === "string"
      ? claim.txHash
      : typeof claim.hash === "string"
        ? claim.hash
        : undefined;

  return {
    ok: true,
    amount,
    to: challengeTo,
    txHash,
    explorerUrl:
      typeof claim.explorerUrl === "string"
        ? claim.explorerUrl
        : txHash
          ? `https://stellar.expert/explorer/testnet/tx/${txHash}`
          : challengeTo.startsWith("C")
            ? `https://stellar.expert/explorer/testnet/contract/${challengeTo}`
            : `https://stellar.expert/explorer/testnet/account/${challengeTo}`,
  };
}

async function preflightClassicG(to: string): Promise<SozuFaucetClaimResult | null> {
  const horizon =
    process.env.HORIZON_URL?.trim() || "https://horizon-testnet.stellar.org";
  const res = await fetch(`${horizon.replace(/\/$/, "")}/accounts/${to}`);

  if (res.status === 404) {
    return {
      ok: false,
      amount: 0,
      error:
        "Treasury G… is not on Stellar testnet yet. Fund it (Friendbot) and add a Circle USDC trustline in Stellar Lab, then retry.",
      reason: "account_missing",
      helpUrl: STELLAR_LAB_TESTNET_FUND_URL,
    };
  }

  if (!res.ok) return null;

  const body = (await res.json().catch(() => null)) as {
    balances?: Array<{
      asset_type?: string;
      asset_code?: string;
      asset_issuer?: string;
    }>;
  } | null;

  const hasTrustline = (body?.balances ?? []).some(
    (b) =>
      b.asset_type === "credit_alphanum4" &&
      b.asset_code === "USDC" &&
      b.asset_issuer === CIRCLE_USDC_TESTNET_ISSUER,
  );

  if (hasTrustline) return null;

  return {
    ok: false,
    amount: 0,
    error:
      "Treasury G… is missing a Circle USDC trustline. Add it in Stellar Lab, then retry the faucet claim.",
    reason: "trustline_required",
    helpUrl: STELLAR_LAB_TESTNET_FUND_URL,
  };
}
