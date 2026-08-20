/**
 * Browser: spend USDC from the authenticated Pollar custodial wallet.
 * Classic G destinations use sendPayment; C destinations use SAC transfer via runTx.
 */
"use client";

import { getPollarBrowserClient, isPollarFakeAuth } from "@/lib/pollar/browser-client";
import { payoutRailForDestination } from "@/lib/payment/payout-rail";

const USDC_ISSUER_TESTNET =
  "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";
const USDC_ISSUER_PUBLIC =
  "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4EZN";

function usdcIssuer(): string {
  return process.env.NEXT_PUBLIC_STELLAR_NETWORK === "public"
    ? USDC_ISSUER_PUBLIC
    : USDC_ISSUER_TESTNET;
}

/** Match server amountToI128 (7 decimals). */
function amountToI128String(amount: string): string {
  const num = parseFloat(amount);
  if (!Number.isFinite(num) || num <= 0) {
    throw new Error(`Invalid amount: ${amount}`);
  }
  return String(Math.round(num * 10 ** 7));
}

export type PollarClientUsdcSendInput = {
  destination: string;
  amount: string;
  /** Expected debit G from the server (session wallet for Pollar staff). */
  fromAddress: string;
  /** Circle USDC SAC contract id (required for C destinations). */
  sacContractId?: string;
};

export type PollarClientUsdcSendResult = {
  stellarTxHash: string;
};

/**
 * Debit the active Pollar session wallet to destination.
 */
export async function sendUsdcViaPollarClient(
  input: PollarClientUsdcSendInput,
): Promise<PollarClientUsdcSendResult> {
  if (isPollarFakeAuth()) {
    throw new Error(
      "Pollar fake auth cannot sign Home treasury payouts in the browser. Enable real Pollar or POLLAR_FAKE_AUTH on the server.",
    );
  }

  const client = getPollarBrowserClient();
  if (!client) {
    throw new Error("Pollar is not configured. Set NEXT_PUBLIC_POLLAR_PUBLISHABLE_KEY.");
  }

  await client.ready();
  const from = (client.getWallet()?.address ?? "").trim();
  if (!from.startsWith("G")) {
    throw new Error("No Pollar custodial wallet in session. Sign in with Google (Pollar).");
  }

  // Pollar can only debit the logged-in custodial G. Home treasury may be another
  // staff member's wallet; authorized distributors send from their own session.
  const source = from;

  const rail = payoutRailForDestination(input.destination);
  if (!rail) {
    throw new Error("Invalid destination address");
  }

  if (rail === "classic") {
    const outcome = await client.sendPayment({
      destination: input.destination.trim(),
      amount: String(input.amount),
      asset: {
        type: "credit_alphanum4",
        code: "USDC",
        issuer: usdcIssuer(),
      },
    });
    if (outcome.status === "error") {
      const detail = outcome.message ?? outcome.details ?? "Pollar USDC payment failed";
      const code = outcome.code ? ` [${outcome.code}]` : "";
      throw new Error(`${detail}${code} (signing ${source.slice(0, 8)}…)`);
    }
    if (!outcome.hash) throw new Error("Pollar payment returned no transaction hash");
    return { stellarTxHash: outcome.hash };
  }

  const sac = (input.sacContractId ?? "").trim();
  if (!sac.startsWith("C")) {
    throw new Error("SAC contract id required to send USDC to a smart account (C…).");
  }

  const outcome = await client.runTx("invoke_contract", {
    contractId: sac,
    method: "transfer",
    args: [
      { type: "address", value: source },
      { type: "address", value: input.destination.trim() },
      { type: "i128", value: amountToI128String(input.amount) },
    ],
  });

  if (outcome.status === "error") {
    const detail = outcome.message ?? outcome.details ?? "Pollar SAC transfer failed";
    const code = outcome.code ? ` [${outcome.code}]` : "";
      throw new Error(`${detail}${code} (signing ${source.slice(0, 8)}…)`);
  }
  if (!outcome.hash) throw new Error("Pollar SAC transfer returned no transaction hash");
  return { stellarTxHash: outcome.hash };
}
