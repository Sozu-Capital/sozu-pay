export type PosPaneState = "empty" | "preview" | "ready" | "expired";

/** POS right pane: empty → preview → ready (QR) → expired. */
export function posPaneState(input: {
  amountUsd: string;
  hasResult: boolean;
  isExpired?: boolean;
}): PosPaneState {
  if (input.hasResult && input.isExpired) return "expired";
  if (input.hasResult) return "ready";
  if (input.amountUsd.trim()) return "preview";
  return "empty";
}
