import type { NextRequest } from "next/server";
import { getAppBaseUrl } from "@/lib/app-url";
import { payerCheckoutUrl, paymentLinkPath } from "@/lib/dashboard/payment-link";

/**
 * Public payer checkout host — this dashboard (`pay.sozu.capital`).
 * SozuCredit (`credit.sozu.capital`) is the recipient wallet, not the payment-link host.
 */
export function getCheckoutBaseUrl(request?: NextRequest): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "";
  // Guard against misconfigured env pointing funding links at SozuCredit.
  if (fromEnv && !/credit\.sozu\.capital/i.test(fromEnv)) {
    return fromEnv;
  }
  if (request?.url) {
    try {
      const origin = new URL(request.url).origin;
      if (!/credit\.sozu\.capital/i.test(origin)) return origin;
    } catch {
      // fall through
    }
  }
  if (fromEnv) return fromEnv;
  return getAppBaseUrl(request);
}

export function checkoutSessionUrl(sessionId: string, request?: NextRequest): string {
  return `${getCheckoutBaseUrl(request)}/checkout/${sessionId}`;
}

/** Sozu Wallet screen where the payer taps Pay with Sozu and the transfer settles. */
export function sozuWalletCheckoutUrl(
  sessionId: string,
  hostHeader?: string | null,
): string {
  return payerCheckoutUrl(
    sessionId,
    hostHeader,
    process.env.NEXT_PUBLIC_SOZU_WALLET_URL,
  );
}

export function checkoutSuccessUrl(sessionId: string, request?: NextRequest): string {
  return `${getCheckoutBaseUrl(request)}/checkout/${sessionId}/success`;
}

/** Stable pay.sozu.capital URL for dynamic QR/NFC. The store scopes the item slug. */
export function merchantQrPayUrl(
  storeSlug: string,
  slug: string,
  request?: NextRequest,
): string {
  const path = paymentLinkPath(storeSlug, slug) ?? `/pay/qr/${slug}`;
  return `${getAppBaseUrl(request)}${path}`;
}
