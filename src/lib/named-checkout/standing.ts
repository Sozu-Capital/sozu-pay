export type StandingCheckoutState = "live" | "off" | "expired";

export function effectiveStandingCheckoutState(input: {
  live: boolean;
  deadlineAt?: string | null;
  now?: Date | number;
}): StandingCheckoutState {
  if (!input.live) return "off";
  if (!input.deadlineAt) return "live";
  const exp = new Date(input.deadlineAt).getTime();
  if (!Number.isFinite(exp)) return "live";
  const now = input.now === undefined ? Date.now() : typeof input.now === "number" ? input.now : input.now.getTime();
  if (now >= exp) return "expired";
  return "live";
}

export function isInactiveStandingCheckout(state: StandingCheckoutState): boolean {
  return state !== "live";
}

/** Completing a sale on a Standing checkout must not retire the Named Checkout URL. */
export function standingSaleRetiresOffer(): false {
  return false;
}

/** POS "expire other pending" only targets POS checkout sessions. */
export function isPosExpireTarget(kind: "pos-session" | "standing"): boolean {
  return kind === "pos-session";
}
