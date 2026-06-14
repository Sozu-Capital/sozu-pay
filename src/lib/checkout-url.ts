import type { NextRequest } from "next/server";
import { getAppBaseUrl } from "@/lib/app-url";

/**
 * Public payer checkout host (SozuCredit wallet).
 * Falls back to SozuPay app URL for local dev without SozuCredit.
 */
export function getCheckoutBaseUrl(request?: NextRequest): string {
  const credit =
    process.env.NEXT_PUBLIC_SOZUCREDIT_URL?.trim() ||
    process.env.SOZUCREDIT_URL?.trim();
  if (credit) return credit.replace(/\/$/, "");
  return getAppBaseUrl(request);
}

export function checkoutSessionUrl(sessionId: string, request?: NextRequest): string {
  return `${getCheckoutBaseUrl(request)}/checkout/${sessionId}`;
}

export function checkoutSuccessUrl(sessionId: string, request?: NextRequest): string {
  return `${getCheckoutBaseUrl(request)}/checkout/${sessionId}/success`;
}

/** Stable pay.sozu.capital URL for dynamic QR/NFC (redirects to live checkout on SozuCredit). */
export function merchantQrPayUrl(slug: string, request?: NextRequest): string {
  return `${getAppBaseUrl(request)}/pay/qr/${slug}`;
}
