"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

const STELLAR_EXPERT_BASE =
  process.env.NODE_ENV === "production" && process.env.NEXT_PUBLIC_STELLAR_NETWORK === "public"
    ? "https://stellar.expert/explorer/public"
    : "https://stellar.expert/explorer/testnet";

export type PayoutModalSuccess = {
  amount: string;
  destination?: string;
  recipientLabel?: string;
  stellarTxHash?: string;
  /** When set, modal shows batch success (N payouts sent). */
  batchCount?: number;
};

type Status = "confirm" | "submitting" | "success" | "failed";

export default function PayoutStatusModal({
  open,
  onClose,
  status,
  userName,
  payoutSummary,
  successData,
  errorMessage,
  batchCount,
  onConfirm,
  confirmMode = "passkey",
}: {
  open: boolean;
  onClose: () => void;
  status: Status;
  userName?: string;
  payoutSummary?: { amount: string; destination?: string; recipientLabel?: string };
  successData?: PayoutModalSuccess | null;
  errorMessage?: string | null;
  /** When set, submitting/success copy is for batch payout (e.g. "Confirm batch", "N payouts sent"). */
  batchCount?: number;
  /** Called when user clicks confirm in the confirm step. */
  onConfirm?: () => void;
  /** Pollar-path uses Disbursement confirmation (no passkey wording). */
  confirmMode?: "passkey" | "pollar";
}) {
  const t = useTranslations("payoutStatusModal");

  if (!open) return null;

  const isBatch = batchCount != null && batchCount > 0;
  const isPollarConfirm = confirmMode === "pollar";

  function summaryLine() {
    if (isBatch) {
      return t("batchRecipients", { count: batchCount ?? 0 });
    }
    if (!payoutSummary) return null;
    const destSuffix = payoutSummary.destination
      ? ` (${payoutSummary.destination.slice(0, 6)}…${payoutSummary.destination.slice(-4)})`
      : "";
    const labelSuffix = payoutSummary.recipientLabel ? ` ${payoutSummary.recipientLabel}` : "";
    return t("singleSummary", {
      amount: payoutSummary.amount,
      recipient: labelSuffix,
      destination: destSuffix,
    });
  }

  function confirmPrompt() {
    return userName
      ? t(isBatch ? "confirmPromptBatch" : "confirmPromptSingle", { name: userName })
      : null;
  }

  const title =
    status === "confirm" || status === "submitting"
      ? isPollarConfirm
        ? t("confirmTitle")
        : t("signTitle")
      : null;

  const confirmLabel = isPollarConfirm ? t("confirmDisbursement") : t("signConfirm");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
      role="dialog"
      aria-modal="true"
      aria-labelledby="payout-modal-title"
      aria-live="polite"
    >
      <div className="w-full max-w-md rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-xl">
        {status === "confirm" && (
          <div className="p-6 text-center">
            <h2 id="payout-modal-title" className="text-lg font-semibold text-gray-900 dark:text-white">
              {title}
            </h2>
            {confirmPrompt() && (
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{confirmPrompt()}</p>
            )}
            {summaryLine() && (
              <p className="mt-3 text-sm text-gray-700 dark:text-gray-300">{summaryLine()}</p>
            )}
            <div className="mt-6 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => onConfirm?.()}
                className="w-full rounded-lg bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 py-2.5 px-4 font-medium hover:opacity-90"
              >
                {confirmLabel}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 py-2.5 px-4 text-sm text-gray-600 dark:text-gray-400"
              >
                {t("cancel")}
              </button>
            </div>
          </div>
        )}

        {status === "submitting" && (
          <>
            <div className="p-6 text-center">
              <div className="mx-auto w-12 h-12 border-4 border-gray-200 dark:border-gray-600 border-t-gray-900 dark:border-t-white rounded-full animate-spin" aria-hidden />
              <h2 id="payout-modal-title" className="mt-4 text-lg font-semibold text-gray-900 dark:text-white">
                {title}
              </h2>
              {confirmPrompt() && (
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{confirmPrompt()}</p>
              )}
              {summaryLine() && (
                <p className="mt-3 text-sm text-gray-700 dark:text-gray-300">{summaryLine()}</p>
              )}
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                {t("submittingNetwork")}
              </p>
            </div>
          </>
        )}

        {status === "success" && successData && (
          <div className="p-6 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30" aria-hidden>
              <svg className="h-10 w-10 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 id="payout-modal-title" className="mt-4 text-lg font-semibold text-gray-900 dark:text-white">
              {successData.batchCount ? t("successBatchTitle") : t("successTitle")}
            </h2>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              {successData.batchCount
                ? t("successBatchLine", { count: successData.batchCount })
                : t("successSingleLine", {
                    amount: successData.amount,
                    recipient: successData.recipientLabel ? ` ${successData.recipientLabel}` : "",
                  })}
            </p>
            <div className="mt-6 flex flex-col gap-2">
              <Link
                href="/dashboard/payouts"
                onClick={onClose}
                className="rounded-lg bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 py-2.5 px-4 font-medium hover:opacity-90"
              >
                {t("viewDisbursementLog")}
              </Link>
              <Link
                href="/dashboard/audit"
                onClick={onClose}
                className="rounded-lg border border-gray-300 dark:border-gray-600 py-2.5 px-4 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                {t("viewAuditLog")}
              </Link>
              {!successData.batchCount && successData.stellarTxHash && (
                <a
                  href={`${STELLAR_EXPERT_BASE}/tx/${successData.stellarTxHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg border border-gray-300 dark:border-gray-600 py-2.5 px-4 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  {t("viewExpert")}
                </a>
              )}
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-gray-200 dark:border-gray-600 py-2.5 px-4 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                {t("close")}
              </button>
            </div>
          </div>
        )}

        {status === "failed" && (
          <div className="p-6 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30" aria-hidden>
              <svg className="h-10 w-10 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 id="payout-modal-title" className="mt-4 text-lg font-semibold text-gray-900 dark:text-white">
              {t("failedTitle")}
            </h2>
            <p className="mt-2 text-sm text-red-600 dark:text-red-400">
              {errorMessage ?? t("failedGeneric")}
            </p>
            <div className="mt-6">
              <Link
                href="/dashboard/payouts"
                onClick={onClose}
                className="inline-block rounded-lg border border-gray-300 dark:border-gray-600 py-2.5 px-4 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                {t("viewDisbursementLog")}
              </Link>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="mt-3 w-full rounded-lg bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 py-2.5 px-4 font-medium"
            >
              {t("close")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
