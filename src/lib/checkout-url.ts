import type { NextRequest } from "next/server";
import { getAppBaseUrl } from "@/lib/app-url";

/**
 * Public payer checkout host — this dashboard (`pay.sozu.capital`).
 * SozuCredit (`credit.sozu.capital`) is the recipient wallet, not the payment-link host.
 */
export function getCheckoutBaseUrl(request?: NextRequest): string {
  return getAppBaseUrl(request);
}

export function checkoutSessionUrl(sessionId: string, request?: NextRequest): string {
  return `${getCheckoutBaseUrl(request)}/checkout/${sessionId}`;
}

export function checkoutSuccessUrl(sessionId: string, request?: NextRequest): string {
  return `${getCheckoutBaseUrl(request)}/checkout/${sessionId}/success`;
}

/** Stable pay.sozu.capital URL for dynamic QR/NFC (redirects to live checkout). */
export function merchantQrPayUrl(slug: string, request?: NextRequest): string {
  return `${getAppBaseUrl(request)}/pay/qr/${slug}`;
}
