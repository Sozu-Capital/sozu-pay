/**
 * Browser: spend USDC or PIZZA from the authenticated Pollar custodial wallet.
 * USDC classic G destinations use sendPayment; USDC C destinations use SAC transfer.
 * PIZZA is always a SEP-41 transfer (never classic USDC).
 */
"use client";

import {
  getPollarBrowserClient,
  getPollarPublishableKey,
  isPollarFakeAuth,
  waitForPollarClientReady,
} from "@/lib/pollar/browser-client";
import { pollarStellarNetworkForClient } from "@/lib/pollar/network";
import type { PayoutAsset } from "@/lib/payouts/asset";
import { pollarSendPlan } from "@/lib/payouts/send-plan";

const USDC_ISSUER_TESTNET =
  "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";
const USDC_ISSUER_PUBLIC =
  "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4EZN";

function usdcIssuer(): string {
  return pollarStellarNetworkForClient(getPollarPublishableKey()) === "mainnet"
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

type PollarSubmitLike = {
  status: string;
  hash?: string;
  message?: string;
  details?: string;
  code?: string;
};

/** Turnkey / 0.12 submit outcomes: success and pending have a hash; cosign waits on the prompt. */
export function stellarHashFromPollarSubmit(
  outcome: PollarSubmitLike,
  source: string,
  fallback: string,
): string {
  if (outcome.status === "error") {
    const detail = outcome.message ?? outcome.details ?? fallback;
    const code = outcome.code ? ` [${outcome.code}]` : "";
    throw new Error(`${detail}${code} (signing ${source.slice(0, 8)}…)`);
  }
  if (outcome.status === "cosign_pending") {
    throw new Error("Approve this payment in the Pollar confirmation prompt, then try again.");
  }
  if (outcome.status !== "success" && outcome.status !== "pending") {
    throw new Error(`${fallback} (${outcome.status})`);
  }
  if (!outcome.hash) throw new Error("Pollar payment returned no transaction hash");
  return outcome.hash;
}

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

  await waitForPollarClientReady(client);
  const wallet = client.getWallet();
  if (wallet?.provisioning === "CREATING") {
    throw new Error("Pollar is still opening your Stellar wallet. Wait a moment and try again.");
  }
  if (wallet?.provisioning === "FAILED") {
    throw new Error("Pollar could not open your Stellar wallet. Sign out and try Google login again.");
  }
  const from = (wallet?.address ?? "").trim();
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
    return {
      stellarTxHash: stellarHashFromPollarSubmit(outcome, source, "Pollar USDC payment failed"),
    };
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

  return {
    stellarTxHash: stellarHashFromPollarSubmit(outcome, source, "Pollar SEP-41 transfer failed"),
  };
}
