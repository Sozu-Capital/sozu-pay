import { payoutRailForDestination } from "@/lib/payment/payout-rail";
import type { PayoutAsset } from "@/lib/payouts/asset";
import { pizzaSendAmountI128 } from "@/lib/payouts/asset";

export type PollarSendPlan =
  | { kind: "classic_usdc"; amount: string }
  | { kind: "sep41"; contractId: string; amountI128: string };

/**
 * How the Pollar session should debit Home treasury.
 * PIZZA is always a SEP-41 transfer (G or C destination) — never a classic USDC payment.
 */
export function pollarSendPlan(input: {
  asset: PayoutAsset;
  destination: string;
  amount: string;
  pizzaTokenId?: string;
  usdcSacId?: string;
}): PollarSendPlan {
  if (input.asset === "PIZZA") {
    const id = (input.pizzaTokenId ?? "").trim();
    if (!id.startsWith("C")) {
      throw new Error("PIZZA token contract id required");
    }
    return {
      kind: "sep41",
      contractId: id,
      amountI128: pizzaSendAmountI128(input.amount),
    };
  }

  const rail = payoutRailForDestination(input.destination);
  if (!rail) {
    throw new Error("Invalid destination address");
  }
  if (rail === "classic") {
    return { kind: "classic_usdc", amount: String(input.amount) };
  }

  const sac = (input.usdcSacId ?? "").trim();
  if (!sac.startsWith("C")) {
    throw new Error("SAC contract id required to send USDC to a smart account (C…).");
  }
  const num = parseFloat(input.amount);
  if (!Number.isFinite(num) || num <= 0) {
    throw new Error(`Invalid amount: ${input.amount}`);
  }
  return {
    kind: "sep41",
    contractId: sac,
    amountI128: String(Math.round(num * 10 ** 7)),
  };
}
