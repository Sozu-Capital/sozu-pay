import type { NextRequest } from "next/server";
import { getCheckoutBaseUrl } from "@/lib/checkout-url";

export function storeLandingPath(storeSlug: string): string {
  return `/${storeSlug}`;
}

export function namedCheckoutPath(storeSlug: string, checkoutSlug: string): string {
  return `/${storeSlug}/${checkoutSlug}`;
}

export function storeLandingUrl(storeSlug: string, request?: NextRequest): string {
  return `${getCheckoutBaseUrl(request)}${storeLandingPath(storeSlug)}`;
}

export function namedCheckoutUrl(
  storeSlug: string,
  checkoutSlug: string,
  request?: NextRequest,
): string {
  return `${getCheckoutBaseUrl(request)}${namedCheckoutPath(storeSlug, checkoutSlug)}`;
}

/** Inactive Named Checkout URL always sends the payer here. */
export function inactiveNamedCheckoutDestination(storeSlug: string): string {
  return storeLandingPath(storeSlug);
}
