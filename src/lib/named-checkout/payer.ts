import { effectiveStandingCheckoutState, isInactiveStandingCheckout } from "./standing";
import { inactiveNamedCheckoutDestination } from "./urls";

export type NamedCheckoutPayerDestination =
  | { kind: "not-found" }
  | { kind: "store-landing"; storeSlug: string; redirect: string }
  | { kind: "pay"; storeSlug: string; checkoutSlug: string };

export type StoreLandingDestination =
  | { kind: "not-found" }
  | { kind: "redirect"; storeSlug: string; redirect: string }
  | { kind: "landing"; storeSlug: string };

/**
 * Payer hit /{store}/{checkout}. Known store + missing/off/expired checkout
 * always goes to that store's landing — never a generic dead-end.
 */
export function namedCheckoutPayerDestination(input: {
  storeKnown: boolean;
  storeSlug: string;
  checkoutSlug: string;
  checkout: { live: boolean; deadlineAt?: string | null } | null;
  now?: Date | number;
}): NamedCheckoutPayerDestination {
  if (!input.storeKnown) return { kind: "not-found" };
  if (!input.checkout) {
    return {
      kind: "store-landing",
      storeSlug: input.storeSlug,
      redirect: inactiveNamedCheckoutDestination(input.storeSlug),
    };
  }
  const state = effectiveStandingCheckoutState({
    live: input.checkout.live,
    deadlineAt: input.checkout.deadlineAt,
    now: input.now,
  });
  if (isInactiveStandingCheckout(state)) {
    return {
      kind: "store-landing",
      storeSlug: input.storeSlug,
      redirect: inactiveNamedCheckoutDestination(input.storeSlug),
    };
  }
  return {
    kind: "pay",
    storeSlug: input.storeSlug,
    checkoutSlug: input.checkoutSlug,
  };
}

/** Visiting an old Store slug after a tag change lands on the current landing. */
export function storeLandingDestination(input: {
  storeKnown: boolean;
  requestedSlug: string;
  currentSlug: string | null;
}): StoreLandingDestination {
  if (!input.storeKnown || !input.currentSlug) return { kind: "not-found" };
  if (input.requestedSlug !== input.currentSlug) {
    return {
      kind: "redirect",
      storeSlug: input.currentSlug,
      redirect: `/${input.currentSlug}`,
    };
  }
  return { kind: "landing", storeSlug: input.currentSlug };
}
