"use client";

type PosPaidConfirmationProps = {
  amountDisplay: string;
  currencyLabel: string;
  statusLabel: string;
  hint: string;
  totalChargeLabel: string;
  children?: React.ReactNode;
};

/**
 * Merchant-facing paid confirmation (Figma POS right pane, success treatment).
 * Distinct from waiting (green pulse + QR) and expired (amber) — big check + CLP amount, no crypto jargon.
 */
export function PosPaidConfirmation({
  amountDisplay,
  currencyLabel,
  statusLabel,
  hint,
  totalChargeLabel,
  children,
}: PosPaidConfirmationProps) {
  return (
    <div className="flex h-full flex-col justify-between" data-testid="pos-paid-confirmation">
      <div className="flex flex-col items-center gap-10">
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300 bg-emerald-50 px-5 py-2 shadow-sm">
          <span
            className="flex size-5 items-center justify-center rounded-full bg-[#16a34a] text-[10px] font-extrabold text-white"
            aria-hidden
          >
            ✓
          </span>
          <span className="text-xs font-extrabold uppercase tracking-wide text-[#16a34a]">
            {statusLabel}
          </span>
        </div>

        <div className="text-center">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#9ca3af]">
            {totalChargeLabel}
          </p>
          <p className="mt-2 text-5xl font-extrabold tabular-nums text-[#050505]">{amountDisplay}</p>
          <p className="mt-1 text-sm font-bold text-[#9ca3af]">{currencyLabel}</p>
          <p className="mt-4 max-w-xs text-sm leading-5 text-gray-600">{hint}</p>
        </div>
      </div>
      {children ? <div className="mt-8 flex flex-col gap-3">{children}</div> : null}
    </div>
  );
}
