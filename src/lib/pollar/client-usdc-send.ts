/**
 * Browser: spend USDC or PIZZA from the authenticated Pollar custodial wallet.
 * USDC classic G destinations use sendPayment; USDC C destinations use SAC transfer.
 * PIZZA is always a SEP-41 transfer (never classic USDC).
 */
"use client";

import { getPollarBrowserClient, isPollarFakeAuth } from "@/lib/pollar/browser-client";
import type { PayoutAsset } from "@/lib/payouts/asset";
import { pollarSendPlan } from "@/lib/payouts/send-plan";

const USDC_ISSUER_TESTNET =
  "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";
const USDC_ISSUER_PUBLIC =
  "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4EZN";

function usdcIssuer(): string {
  return process.env.NEXT_PUBLIC_STELLAR_NETWORK === "public"
    ? USDC_ISSUER_PUBLIC
    : USDC_ISSUER_TESTNET;
}

export type PollarClientUsdcSendInput = {
  destination: string;
  amount: string;
  /** Expected debit G from the server (session wallet for Pollar staff). */
  fromAddress: string;
  /** Circle USDC SAC (C dest) or PizzaToken contract (PIZZA). */
  sacContractId?: string;
  asset?: PayoutAsset;
  /** Server-encoded i128 for SEP-41 (PIZZA is 0 decimals). */
  amountI128?: string;
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
  const asset: PayoutAsset = input.asset === "PIZZA" ? "PIZZA" : "USDC";
  const plan = pollarSendPlan({
    asset,
    destination: input.destination,
    amount: input.amount,
    pizzaTokenId: asset === "PIZZA" ? input.sacContractId : undefined,
    usdcSacId: asset === "USDC" ? input.sacContractId : undefined,
  });

  if (plan.kind === "classic_usdc") {
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

  const amountI128 = (input.amountI128 ?? plan.amountI128).trim();
  const outcome = await client.runTx("invoke_contract", {
    contractId: plan.contractId,
    method: "transfer",
    args: [
      { type: "address", value: source },
      { type: "address", value: input.destination.trim() },
      { type: "i128", value: amountI128 },
    ],
  });

  if (outcome.status === "error") {
    const detail = outcome.message ?? outcome.details ?? "Pollar SEP-41 transfer failed";
    const code = outcome.code ? ` [${outcome.code}]` : "";
    throw new Error(`${detail}${code} (signing ${source.slice(0, 8)}…)`);
  }
  if (!outcome.hash) throw new Error("Pollar SEP-41 transfer returned no transaction hash");
  return { stellarTxHash: outcome.hash };
}
