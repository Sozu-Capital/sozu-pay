/** Format a cashier-readable receipt timestamp (local locale). */
export function formatPosReceiptTime(
  iso: string | null | undefined,
  locale = "es-CL",
): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "—";
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}

export type PosReceiptFields = {
  amountClpDisplay: string;
  currencyLabel: string;
  paidAtLabel: string;
  paymentId: string;
  reference: string | null;
  txHash: string | null;
};

export function buildPosReceiptFields(input: {
  amountClp: string;
  formatAmount: (raw: string) => string;
  currencyLabel: string;
  paidAtIso: string | null;
  paymentId: string;
  reference: string | null;
  txHash?: string | null;
  locale?: string;
}): PosReceiptFields {
  const hash = input.txHash?.trim() ?? "";
  return {
    amountClpDisplay: input.formatAmount(input.amountClp),
    currencyLabel: input.currencyLabel,
    paidAtLabel: formatPosReceiptTime(input.paidAtIso, input.locale),
    paymentId: input.paymentId,
    reference: input.reference?.trim() ? input.reference.trim() : null,
    txHash: /^[a-fA-F0-9]{64}$/.test(hash) ? hash : null,
  };
}
