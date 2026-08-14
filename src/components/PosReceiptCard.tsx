"use client";

import type { PosReceiptFields } from "@/lib/dashboard/pos-receipt";

type PosReceiptCardProps = {
  fields: PosReceiptFields;
  labels: {
    title: string;
    amount: string;
    time: string;
    paymentId: string;
    reference: string;
  };
};

/** Lightweight cashier receipt summary after paid confirmation (no printer). */
export function PosReceiptCard({ fields, labels }: PosReceiptCardProps) {
  return (
    <div
      className="w-full rounded-3xl border border-[#f3f4f6] bg-[#f9fafb] p-5 text-left"
      data-testid="pos-receipt-card"
    >
      <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#9ca3af]">{labels.title}</p>
      <dl className="mt-3 space-y-2 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-gray-500">{labels.amount}</dt>
          <dd className="font-extrabold tabular-nums text-[#050505]">
            {fields.amountClpDisplay} {fields.currencyLabel}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-gray-500">{labels.time}</dt>
          <dd className="font-medium text-[#050505]">{fields.paidAtLabel}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-gray-500">{labels.paymentId}</dt>
          <dd className="max-w-[60%] truncate font-mono text-xs text-[#050505]">{fields.paymentId}</dd>
        </div>
        {fields.reference ? (
          <div className="flex justify-between gap-4">
            <dt className="text-gray-500">{labels.reference}</dt>
            <dd className="font-medium text-[#050505]">{fields.reference}</dd>
          </div>
        ) : null}
      </dl>
    </div>
  );
}
