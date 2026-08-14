/**
 * When regenerating a POS QR, keep the last charged CLP on the keypad so the
 * cashier does not retype. Creating a new payment request expires the previous
 * pending session server-side (`expirePendingCheckoutSessionsForOrg`).
 */
export function amountClpForRegeneration(input: {
  keypadAmountClp: string;
  lastChargedClp: string | null | undefined;
}): string {
  const keyed = input.keypadAmountClp.trim();
  if (keyed) return keyed;
  return (input.lastChargedClp ?? "").trim();
}
