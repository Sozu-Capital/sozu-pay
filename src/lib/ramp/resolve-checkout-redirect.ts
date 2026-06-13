/** Dev admin dashboard origins — checkout success pages live on SozuPay, not admin. */
const ADMIN_DEV_ORIGINS = new Set([
  "http://localhost:3001",
  "http://127.0.0.1:3001",
]);

function payOrigin(explicit?: string): string {
  if (explicit) return explicit.replace(/\/$/, "");
  if (typeof window !== "undefined") return window.location.origin;
  return (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

/**
 * Stub ramp checkouts may embed a success redirect built with the wrong APP_URL
 * (e.g. localhost:3001). Rewrite /checkout/{id}/success to SozuPay.
 */
export function resolveCheckoutSuccessRedirect(
  redirectParam: string,
  checkoutRef?: string,
  origin?: string,
): string {
  const targetOrigin = payOrigin(origin);

  if (redirectParam) {
    try {
      const decoded = decodeURIComponent(redirectParam);
      const url = new URL(decoded);
      if (/^\/checkout\/[^/]+\/success$/.test(url.pathname)) {
        if (ADMIN_DEV_ORIGINS.has(url.origin) || url.port === "3001") {
          const pay = new URL(targetOrigin);
          url.protocol = pay.protocol;
          url.host = pay.host;
          return url.toString();
        }
        return decoded;
      }
    } catch {
      // fall through
    }
  }

  if (checkoutRef) {
    return `${targetOrigin}/checkout/${checkoutRef}/success`;
  }

  return `${targetOrigin}/dashboard/checkout`;
}
