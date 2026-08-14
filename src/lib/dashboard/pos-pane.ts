export type PosPaneState = "empty" | "preview" | "ready" | "expired" | "paid";

/** POS right pane: empty → preview → ready (QR) → expired | paid. */
export function posPaneState(input: {
  amountUsd: string;
  hasResult: boolean;
  isExpired?: boolean;
  isPaid?: boolean;
}): PosPaneState {
  if (input.hasResult && input.isPaid) return "paid";
  if (input.hasResult && input.isExpired) return "expired";
  if (input.hasResult) return "ready";
  if (input.amountUsd.trim()) return "preview";
  return "empty";
}
