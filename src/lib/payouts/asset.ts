import { pizzaAmountToI128 } from "@/lib/stellar/pizza-token";

export const PAYOUT_ASSETS = ["USDC", "PIZZA"] as const;
export type PayoutAsset = (typeof PAYOUT_ASSETS)[number];

/** Missing / blank asset stays USDC so existing send clients keep working. */
export function parsePayoutAsset(raw: unknown): PayoutAsset {
  if (raw == null || raw === "") return "USDC";
  if (typeof raw !== "string") {
    throw new Error("Unsupported payout asset");
  }
  const n = raw.trim().toUpperCase();
  if (n === "PIZZA") return "PIZZA";
  if (n === "USDC") return "USDC";
  throw new Error(`Unsupported payout asset: ${raw}`);
}

/** Whole pizzas only — SEP-41 PizzaToken has 0 decimals. */
export function parsePizzaSendAmount(amount: string): number {
  const trimmed = amount.trim();
  if (!/^[1-9][0-9]*$/.test(trimmed)) {
    throw new Error("PIZZA amount must be a whole number of at least 1");
  }
  return Number(trimmed);
}

export function pizzaSendAmountI128(amount: string): string {
  return String(pizzaAmountToI128(parsePizzaSendAmount(amount)));
}

export function payoutAssetSymbol(asset: PayoutAsset): "USDC" | "PIZZA" {
  return asset;
}
