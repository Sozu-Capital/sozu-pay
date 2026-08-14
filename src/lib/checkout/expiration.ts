/**
 * POS / checkout payment-request TTL.
 *
 * Default 15 minutes — long enough for a cashier demo, short enough that abandoned
 * QRs stop being payable. Override with CHECKOUT_PAYMENT_TTL_MS (milliseconds).
 */

export const DEFAULT_CHECKOUT_PAYMENT_TTL_MS = 15 * 60 * 1000;

export function getCheckoutPaymentTtlMs(
  envValue: string | undefined = process.env.CHECKOUT_PAYMENT_TTL_MS,
): number {
  const n = Number(envValue);
  if (Number.isFinite(n) && n > 0) return Math.floor(n);
  return DEFAULT_CHECKOUT_PAYMENT_TTL_MS;
}

export function computeCheckoutExpiresAt(
  createdAt: Date | string | number = Date.now(),
  ttlMs: number = getCheckoutPaymentTtlMs(),
): string {
  const start = typeof createdAt === "number" ? createdAt : new Date(createdAt).getTime();
  return new Date(start + ttlMs).toISOString();
}

/** True when now is at or past expiresAt (inclusive boundary). */
export function isCheckoutExpired(
  expiresAt: string | null | undefined,
  now: Date | number = Date.now(),
): boolean {
  if (!expiresAt) return false;
  const exp = new Date(expiresAt).getTime();
  if (!Number.isFinite(exp)) return false;
  const t = typeof now === "number" ? now : now.getTime();
  return t >= exp;
}

/**
 * Effective status for pay/POS paths: pending sessions past expires_at become expired.
 */
export function effectiveCheckoutStatus(input: {
  status: string;
  expiresAt?: string | null;
  now?: Date | number;
}): "pending" | "completed" | "failed" | "expired" | string {
  if (input.status === "pending" && isCheckoutExpired(input.expiresAt, input.now ?? Date.now())) {
    return "expired";
  }
  return input.status;
}
