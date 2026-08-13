/**
 * Batch funding helpers for disbursement UI gates.
 * Pollar path checks org treasury; passkey/legacy checks SDP distribution.
 */

export type BatchFundingCheck = {
  remaining: number;
  availableUsdc: number;
};

const EPSILON = 1e-9;

/**
 * Is a batch sufficiently funded for spending?
 * True when remaining amount is covered (with epsilon for floating point).
 */
export function isBatchFunded(check: BatchFundingCheck): boolean {
  if (check.remaining <= 0) return true;
  return check.availableUsdc + EPSILON >= check.remaining;
}

/**
 * Extract available USDC from dashboard profile balance for Pollar org treasury funding checks.
 */
export function pollarBatchAvailableUsdc(balance: {
  usdc?: string;
} | null): number {
  if (!balance?.usdc) return 0;
  const parsed = parseFloat(balance.usdc);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}
