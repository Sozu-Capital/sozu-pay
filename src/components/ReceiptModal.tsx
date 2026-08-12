"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

export interface ReceiptSession {
  id: string;
  status: string;
  amountUsd: string;
  reference: string | null;
  createdAt: string;
  paymentMethod?: string | null;
  allowDebit?: boolean;
  allowCredit?: boolean;
  allowBankTransfer?: boolean;
  stellarTxHash?: string | null;
  completedPaymentMethod?: string | null;
}

export interface ReceiptTransaction {
  id: string; // Transaction hash
  date: string;
  amount: string;
  type: string;
  source: string;
  status: string;
  stellarExpertUrl: string;
}

type ReceiptModalProps = {
  open: boolean;
  onClose: () => void;
  checkoutSession?: ReceiptSession | null;
  transaction?: ReceiptTransaction | null;
  orgName?: string | null;
  loading?: boolean;
};

export default function ReceiptModal({
  open,
  onClose,
  checkoutSession,
  transaction,
  orgName,
  loading = false,
}: ReceiptModalProps) {
  const t = useTranslations("receiptModal");
  const [copied, setCopied] = useState(false);

  if (!open) return null;

  if (loading) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-[1px]"
        role="dialog"
        aria-modal="true"
      >
        <div className="relative z-10 w-full max-w-sm overflow-hidden rounded-xl border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-700 dark:bg-gray-800 text-center">
          <div className="mx-auto w-10 h-10 border-4 border-gray-200 dark:border-gray-600 border-t-blue-600 dark:border-t-blue-400 rounded-full animate-spin" />
          <p className="mt-4 text-sm text-gray-500 dark:text-gray-400 font-medium">
            {t("loading")}
          </p>
        </div>
      </div>
    );
  }

  // Resolve details from either checkoutSession or transaction
  const isCheckout = !!checkoutSession;
  const id = checkoutSession?.id ?? "";
  const status = (checkoutSession?.status ?? transaction?.status ?? "pending").toLowerCase();
  const dateStr = checkoutSession?.createdAt ?? transaction?.date ?? "";
  const reference = checkoutSession?.reference ?? null;
  const txHash = checkoutSession?.stellarTxHash ?? transaction?.id ?? null;
  
  // Format amount
  let amountStr = "0.00";
  if (checkoutSession) {
    amountStr = `$${parseFloat(checkoutSession.amountUsd).toFixed(2)} USD`;
  } else if (transaction) {
    amountStr = transaction.amount.toUpperCase().includes("USDC")
      ? transaction.amount
      : `${parseFloat(transaction.amount).toFixed(2)} USDC`;
  }

  // Payment method
  const paymentMethod = isCheckout
    ? checkoutSession?.completedPaymentMethod ?? checkoutSession?.paymentMethod ?? null
    : "Stellar Network";

  const isPending = status === "pending";

  const statusColor =
    status === "completed" || status === "success"
      ? "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30"
      : status === "failed"
        ? "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30"
        : "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30";

  // Stellar Expert URL
  const expertUrl =
    transaction?.stellarExpertUrl ??
    (txHash
      ? `${
          process.env.NEXT_PUBLIC_STELLAR_NETWORK === "public"
            ? "https://stellar.expert/explorer/public"
            : "https://stellar.expert/explorer/testnet"
        }/tx/${txHash}`
      : null);

  // Download PDF via Iframe window.print()
  const handleDownloadPDF = () => {
    if (isPending) return;

    const printIframe = document.createElement("iframe");
    printIframe.style.position = "fixed";
    printIframe.style.right = "0";
    printIframe.style.bottom = "0";
    printIframe.style.width = "0";
    printIframe.style.height = "0";
    printIframe.style.border = "0";
    document.body.appendChild(printIframe);

    const iframeDoc = printIframe.contentWindow?.document || printIframe.contentDocument;
    if (iframeDoc) {
      const displayDate = dateStr && !Number.isNaN(Date.parse(dateStr))
        ? new Date(dateStr).toLocaleString()
        : "—";

      iframeDoc.write(`
        <html>
          <head>
            <title>Receipt - ${id || txHash || "Transaction"}</title>
            <style>
              body { font-family: system-ui, -apple-system, sans-serif; padding: 40px; color: #111827; background-color: #ffffff; }
              .receipt { max-width: 400px; margin: 0 auto; border: 1px solid #e5e7eb; padding: 24px; border-radius: 12px; }
              .header { text-align: center; border-bottom: 2px dashed #e5e7eb; padding-bottom: 16px; margin-bottom: 20px; }
              .title { font-size: 20px; font-weight: bold; margin: 0; color: #1f2937; }
              .amount { font-size: 32px; font-weight: 800; margin: 8px 0; color: #059669; }
              .row { display: flex; justify-content: space-between; margin-bottom: 12px; font-size: 14px; }
              .label { color: #6b7280; }
              .val { font-weight: 500; word-break: break-all; text-align: right; max-width: 200px; color: #111827; }
              .footer { text-align: center; margin-top: 30px; font-size: 11px; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 12px; }
            </style>
          </head>
          <body>
            <div class="receipt">
              <div class="header">
                <p class="label">SozuPay Receipt</p>
                <div class="title">${orgName || "Merchant Receipt"}</div>
                <div class="amount">${amountStr}</div>
              </div>
              <div class="row"><span class="label">Status</span><span class="val" style="text-transform: capitalize;">${status}</span></div>
              <div class="row"><span class="label">Date</span><span class="val">${displayDate}</span></div>
              ${reference ? `<div class="row"><span class="label">Reference</span><span class="val">${reference}</span></div>` : ""}
              ${paymentMethod ? `<div class="row"><span class="label">Payment Method</span><span class="val" style="text-transform: capitalize;">${paymentMethod}</span></div>` : ""}
              ${txHash ? `<div class="row"><span class="label">Transaction Hash</span><span class="val" style="font-family: monospace; font-size: 11px;">${txHash}</span></div>` : ""}
              <div class="footer">
                Thank you for your business!<br/>
                Generated by SozuPay
              </div>
            </div>
          </body>
        </html>
      `);
      iframeDoc.close();

      setTimeout(() => {
        printIframe.contentWindow?.focus();
        printIframe.contentWindow?.print();
        setTimeout(() => {
          document.body.removeChild(printIframe);
        }, 1000);
      }, 500);
    }
  };

  // Share Receipt Link
  const handleShare = async () => {
    if (isPending) return;

    const checkoutBaseUrl =
      process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
      (typeof window !== "undefined" ? window.location.origin : "");
    const shareUrl = isCheckout
      ? `${checkoutBaseUrl}/checkout/${id}`
      : expertUrl ?? "";

    if (!shareUrl) return;

    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: t("title"),
          text: `Payment receipt for ${amountStr}`,
          url: shareUrl,
        });
        return;
      } catch (err) {
        // Fallback to clipboard if sharing is cancelled or fails
      }
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback: no-op
    }
  };

  const formattedDate =
    dateStr && !Number.isNaN(Date.parse(dateStr))
      ? new Date(dateStr).toLocaleString()
      : "—";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="receipt-modal-title"
    >
      <button
        type="button"
        className="absolute inset-0"
        aria-label={t("close")}
        onClick={onClose}
      />
      
      <div className="relative z-10 w-full max-w-md overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-800">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 dark:border-gray-700">
          <h3
            id="receipt-modal-title"
            className="text-lg font-semibold text-gray-900 dark:text-white"
          >
            {isCheckout ? t("checkoutTitle") : t("transactionTitle")}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-200"
          >
            <span className="sr-only">{t("close")}</span>
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="text-center pb-6 border-b border-gray-100 dark:border-gray-700">
            <p className="text-sm font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">
              {orgName || t("title")}
            </p>
            <h4 className="mt-2 text-3xl font-extrabold text-gray-900 dark:text-white">
              {amountStr}
            </h4>
            <span className={`inline-flex items-center gap-1.5 mt-3 px-3 py-1 text-xs font-semibold rounded-full capitalize ${statusColor}`}>
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              {status}
            </span>
          </div>

          <div className="mt-6 space-y-4 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">{t("date")}</span>
              <span className="font-medium text-gray-900 dark:text-white">{formattedDate}</span>
            </div>

            {reference && (
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">{t("reference")}</span>
                <span className="font-medium text-gray-900 dark:text-white">{reference}</span>
              </div>
            )}

            {paymentMethod && (
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">{t("paymentMethod")}</span>
                <span className="font-medium text-gray-900 dark:text-white capitalize">{paymentMethod}</span>
              </div>
            )}

            {txHash && (
              <div className="flex flex-col gap-1 border-t border-gray-50 pt-3 dark:border-gray-700/50">
                <span className="text-gray-500 dark:text-gray-400">{t("transaction")}</span>
                <span className="font-mono text-xs text-gray-900 dark:text-gray-300 break-all select-all">
                  {txHash}
                </span>
              </div>
            )}
          </div>

          {/* Expert Link */}
          {expertUrl && (
            <div className="mt-6 text-center">
              <a
                href={expertUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
              >
                {t("viewExpert")}
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            </div>
          )}

          {/* Actions (Only if NOT pending) */}
          {!isPending && (
            <div className="mt-8 flex gap-3">
              <button
                type="button"
                onClick={handleDownloadPDF}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                {t("downloadPdf")}
              </button>
              <button
                type="button"
                onClick={handleShare}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                {copied ? (
                  <>
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    {t("copied")}
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 10.742l-2.084 1.157M10.244 11.361l4.332 2.406m6-1.5a3 3 0 11-6 0 3 3 0 016 0zm-12.75-6a3 3 0 11-6 0 3 3 0 016 0zm12.75 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    {t("share")}
                  </>
                )}
              </button>
            </div>
          )}

          {isPending && (
            <div className="mt-8">
              <button
                type="button"
                onClick={onClose}
                className="w-full inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
              >
                {t("close")}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
