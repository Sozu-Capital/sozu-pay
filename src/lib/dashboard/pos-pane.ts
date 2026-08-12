export type PosPaneState = "empty" | "preview" | "ready";

/** POS right pane: empty hint → amount preview → ready (QR + charged amount). */
export function posPaneState(input: {
  amountUsd: string;
  hasResult: boolean;
}): PosPaneState {
  if (input.hasResult) return "ready";
  if (input.amountUsd.trim()) return "preview";
  return "empty";
}
