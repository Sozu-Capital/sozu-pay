"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { PosPaymentQrCard } from "@/components/PosPaymentQrCard";
import { PosPaidConfirmation } from "@/components/PosPaidConfirmation";
import { PosReceiptCard } from "@/components/PosReceiptCard";
import {
  CHECKOUT_SETUP_WALLET_PATH,
  isCheckoutWalletNotReadyHttpStatus,
} from "@/lib/checkout/ready";
import { posPaneState } from "@/lib/dashboard/pos-pane";
import { applyPosKeypadKey, type PosKeypadKey } from "@/lib/dashboard/pos-keypad";
import {
  POS_CLP_FRACTION_DIGITS,
  formatClpDisplay,
  parseWholeClpAmount,
} from "@/lib/pos/clp-pricing";
import { isCheckoutExpired } from "@/lib/checkout/expiration";
import { amountClpForRegeneration } from "@/lib/dashboard/pos-regenerate";
import {
  POS_STATUS_POLL_MS,
  posListenPhaseFromStatus,
} from "@/lib/dashboard/pos-payment-listen";
import { buildPosReceiptFields } from "@/lib/dashboard/pos-receipt";
import { readyForNextPaymentState } from "@/lib/dashboard/pos-ready-next";

type CreateResult = {
  checkoutUrl: string;
  id: string;
  amountClp: string;
  reference: string | null;
  expiresAt: string | null;
};

const KEYPAD_KEYS: PosKeypadKey[] = [
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  ".",
  "0",
  "backspace",
];

function BackspaceIcon() {
  return (
    <svg
      width="34"
      height="30"
      viewBox="0 0 34 30"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className="h-[30px] w-[34px]"
    >
      <path
        d="M12.5 4H29a3 3 0 0 1 3 3v16a3 3 0 0 1-3 3H12.5L3 15l9.5-11Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M16 10.5 23.5 18M23.5 10.5 16 18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function PosShell() {
  const t = useTranslations("posPage");
  const tc = useTranslations("checkoutPage");
  const [amountClp, setAmountClp] = useState("");
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CreateResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [walletReady, setWalletReady] = useState<boolean | null>(null);
  const [setupUrl, setSetupUrl] = useState(CHECKOUT_SETUP_WALLET_PATH);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [paid, setPaid] = useState(false);
  const [paidAt, setPaidAt] = useState<string | null>(null);
  const [showReceipt, setShowReceipt] = useState(false);
  const [keypadEpoch, setKeypadEpoch] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/checkout/ready", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled) return;
        if (d && d.ready === false) {
          setWalletReady(false);
          if (typeof d.setupUrl === "string" && d.setupUrl.startsWith("/")) {
            setSetupUrl(d.setupUrl);
          }
          return;
        }
        setWalletReady(true);
      })
      .catch(() => {
        if (!cancelled) setWalletReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!result?.expiresAt) return;
    const tick = () => setNowMs(Date.now());
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [result?.expiresAt]);

  // Poll checkout status while waiting — advances to paid without merchant refresh.
  useEffect(() => {
    if (!result?.id || paid) return;
    let cancelled = false;

    const poll = async () => {
      try {
        const res = await fetch(
          `/api/checkout/status?id=${encodeURIComponent(result.id)}`,
          { credentials: "include" },
        );
        if (!res.ok || cancelled) return;
        const data = (await res.json().catch(() => null)) as {
          status?: string;
          expiresAt?: string | null;
        } | null;
        if (!data || cancelled) return;
        const phase = posListenPhaseFromStatus(
          { status: data.status, expiresAt: data.expiresAt ?? result.expiresAt },
          Date.now(),
        );
        if (phase === "paid") {
          setPaid(true);
          setPaidAt((prev) => prev ?? new Date().toISOString());
          return;
        }
        if (phase === "expired" && data.expiresAt) {
          setResult((prev) =>
            prev ? { ...prev, expiresAt: data.expiresAt ?? prev.expiresAt } : prev,
          );
        }
      } catch {
        /* keep waiting; next tick retries */
      }
    };

    void poll();
    const timer = window.setInterval(() => void poll(), POS_STATUS_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [result?.id, result?.expiresAt, paid]);
  const pressKey = (key: PosKeypadKey) => {
    setAmountClp((prev) =>
      applyPosKeypadKey(prev, key, { maxFractionDigits: POS_CLP_FRACTION_DIGITS }),
    );
  };

  const handleCreate = async (overrideAmountClp?: string) => {
    setError(null);
    const amountToCharge = (overrideAmountClp ?? amountClp).trim();
    if (parseWholeClpAmount(amountToCharge) == null) {
      setError(tc("invalidAmount"));
      return;
    }
    if (overrideAmountClp != null && overrideAmountClp.trim() !== amountClp.trim()) {
      setAmountClp(overrideAmountClp.trim());
    }
    setBusy(true);
    try {
      const idempotencyKey =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `pos_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      const res = await fetch("/api/checkout/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({
          amountClp: amountToCharge,
          reference: reference.trim() || undefined,
          allowDebit: true,
          allowCredit: true,
          allowBankTransfer: true,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (isCheckoutWalletNotReadyHttpStatus(res.status)) {
          setWalletReady(false);
          setError(null);
          return;
        }
        setError((data.error as string) ?? tc("createFailed"));
        return;
      }
      const chargedClp =
        typeof data.amountClp === "string" && data.amountClp.trim()
          ? data.amountClp.trim()
          : amountToCharge;
      const chargedReference =
        typeof data.reference === "string" && data.reference.trim()
          ? data.reference.trim()
          : reference.trim() || null;
      // Keep keypad amount visible while the QR / waiting panel shows.
      setPaid(false);
      setPaidAt(null);
      setShowReceipt(false);
      setResult({
        checkoutUrl: data.checkoutUrl,
        id: data.id,
        amountClp: chargedClp,
        reference: chargedReference,
        expiresAt:
          typeof data.expiresAt === "string" && data.expiresAt.trim()
            ? data.expiresAt.trim()
            : null,
      });
    } finally {
      setBusy(false);
    }
  };

  const handleRegenerate = async () => {
    const nextAmount = amountClpForRegeneration({
      keypadAmountClp: amountClp,
      lastChargedClp: result?.amountClp,
    });
    await handleCreate(nextAmount);
  };

  const copyLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  const readyForNextPayment = () => {
    const next = readyForNextPaymentState();
    setAmountClp(next.amountClp);
    setReference(next.reference);
    setResult(next.result);
    setPaid(next.paid);
    setPaidAt(next.paidAt);
    setError(next.error);
    setShowReceipt(next.showReceipt);
    setKeypadEpoch((n) => n + 1);
  };

  const chargeExpired = !!(
    result && !paid && isCheckoutExpired(result.expiresAt, nowMs)
  );
  const pane = posPaneState({
    amountUsd: amountClp,
    hasResult: !!result,
    isExpired: chargeExpired,
    isPaid: paid,
  });
  const displayAmount = formatClpDisplay(amountClp);
  const sideTotal = formatClpDisplay(result?.amountClp ?? amountClp);
  const receiptFields =
    result &&
    buildPosReceiptFields({
      amountClp: result.amountClp,
      formatAmount: formatClpDisplay,
      currencyLabel: t("currencyLabel"),
      paidAtIso: paidAt,
      paymentId: result.id,
      reference: result.reference,
    });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
          {t("title")}
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t("subtitle")}</p>
      </header>

      {walletReady === false && (
        <div className="rounded-2xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-6">
          <h2 className="text-lg font-semibold text-amber-950 dark:text-amber-100">
            {t("walletNotReadyTitle")}
          </h2>
          <p className="mt-2 text-sm text-amber-900 dark:text-amber-200">
            {t("walletNotReadyBody")}
          </p>
          <Link
            href={setupUrl}
            className="mt-4 inline-flex rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-4 py-2 text-sm transition-colors"
          >
            {t("walletNotReadyCta")}
          </Link>
        </div>
      )}

      {walletReady !== false && (
        <div className="overflow-hidden rounded-[48px] border border-[#f3f4f6] bg-white shadow-[0px_25px_50px_-12px_rgba(0,0,0,0.25)] lg:flex">
          <div className="flex flex-1 flex-col items-center justify-center bg-[rgba(249,250,251,0.3)] px-6 py-10 sm:px-12 lg:px-16 lg:py-16">
            <div className="mb-10 flex w-full max-w-md flex-col items-center gap-4">
              <p className="text-center text-2xl font-bold tracking-wide text-[#9ca3af]">
                {t("currencyLabel")}
              </p>
              <p
                className="max-w-full truncate text-center text-6xl font-extrabold tracking-tighter text-[#050505] sm:text-7xl lg:text-[7.5rem] lg:leading-none"
                data-testid="pos-amount-display"
                aria-live="polite"
              >
                {displayAmount}
              </p>
            </div>

            <div
              key={keypadEpoch}
              className="grid w-full max-w-md grid-cols-3 gap-3 sm:gap-4"
              role="group"
              aria-label={t("keypadAria")}
            >
              {KEYPAD_KEYS.map((key) => {
                const isBackspace = key === "backspace";
                const isDecimalDisabled = key === "." && POS_CLP_FRACTION_DIGITS <= 0;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => pressKey(key)}
                    disabled={isDecimalDisabled}
                    aria-label={
                      isBackspace
                        ? t("backspaceAria")
                        : isDecimalDisabled
                          ? t("decimalDisabledAria")
                          : undefined
                    }
                    className={
                      isBackspace
                        ? "flex items-center justify-center rounded-3xl border border-[#e5e7eb] bg-[#f3f4f6] px-4 py-6 text-[#050505] transition-transform active:scale-[0.98]"
                        : isDecimalDisabled
                          ? "flex items-center justify-center rounded-3xl border border-[#f3f4f6] bg-[#f9fafb] px-4 py-6 text-3xl font-extrabold tracking-widest text-[#d1d5db]"
                          : "flex items-center justify-center rounded-3xl border border-[#f3f4f6] bg-white px-4 py-6 text-3xl font-extrabold tracking-widest text-[#050505] shadow-sm transition-transform active:scale-[0.98]"
                    }
                  >
                    {isBackspace ? <BackspaceIcon /> : key}
                  </button>
                );
              })}
            </div>

            <div className="mt-8 w-full max-w-md space-y-3">
              <label className="block text-sm font-medium text-gray-600">
                {tc("referenceLabel")}
                <input
                  type="text"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900"
                  placeholder={tc("referencePlaceholder")}
                />
              </label>

              {error && (
                <p className="text-sm text-red-600" role="alert">
                  {error}
                </p>
              )}

              {!result && (
                <button
                  type="button"
                  onClick={() => void handleCreate()}
                  disabled={busy}
                  className="w-full rounded-[28px] bg-[#050505] py-5 text-xl font-extrabold text-white shadow-[0px_25px_50px_-12px_rgba(0,0,0,0.2)] transition-opacity disabled:opacity-50"
                >
                  {busy ? t("creating") : t("createCharge")}
                </button>
              )}

              <p className="text-center text-xs text-gray-500">
                {t("managePoints")}{" "}
                <Link
                  href="/dashboard/qr-codes"
                  className="font-medium text-emerald-700 underline-offset-2 hover:underline"
                >
                  {t("managePointsLink")}
                </Link>
              </p>
            </div>
          </div>

          <div className="relative flex w-full flex-col justify-between border-t border-[#f3f4f6] bg-white p-8 lg:w-[426px] lg:shrink-0 lg:border-l lg:border-t-0 lg:p-12">
            {pane === "empty" && (
              <div className="flex flex-1 items-center justify-center text-center text-sm text-gray-500">
                {t("emptyHint")}
              </div>
            )}

            {pane === "preview" && (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#9ca3af]">
                  {t("totalCharge")}
                </p>
                <p className="text-5xl font-extrabold tabular-nums text-[#050505]">
                  {sideTotal}
                </p>
                <p className="text-sm font-bold text-[#9ca3af]">{t("currencyLabel")}</p>
                <p className="mt-4 max-w-xs text-sm text-gray-500">{t("previewHint")}</p>
              </div>
            )}

            {pane === "ready" && result && (
              <>
                <div className="flex flex-col items-center gap-10">
                  <div className="inline-flex items-center gap-2 rounded-full border border-[#dcfce7] bg-[#f0fdf4] px-5 py-2">
                    <span className="size-2 rounded-full bg-[#22c55e]" aria-hidden />
                    <span className="text-xs font-extrabold text-[#16a34a]">
                      {t("waitingForCustomer")}
                    </span>
                  </div>

                  <div className="text-center">
                    <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#9ca3af]">
                      {t("totalCharge")}
                    </p>
                    <p className="mt-2 text-5xl font-extrabold tabular-nums text-[#050505]">
                      {formatClpDisplay(result.amountClp)}
                    </p>
                    <p className="mt-1 text-sm font-bold text-[#9ca3af]">{t("currencyLabel")}</p>
                    {result.reference && (
                      <p className="mt-2 text-xs text-gray-500">
                        {t("chargedReference", { reference: result.reference })}
                      </p>
                    )}
                  </div>

                  <PosPaymentQrCard
                    checkoutUrl={result.checkoutUrl}
                    alt={t("qrAlt")}
                    caption={t("scanCaption")}
                  />
                </div>

                <div className="mt-8 flex flex-col gap-4">
                  <div className="flex items-center justify-center gap-3 rounded-3xl border border-[#dbeafe] bg-[rgba(239,246,255,0.5)] py-5 text-sm font-extrabold tracking-tight text-[#2563eb]">
                    <span aria-hidden className="inline-block size-4 rounded-sm bg-[#2563eb]/opacity-80" />
                    {t("nfcStrip")}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => copyLink(result.checkoutUrl)}
                      className="flex-1 rounded-2xl border border-gray-200 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      {copied ? tc("copied") : tc("copyLink")}
                    </button>
                    <button
                      type="button"
                      onClick={handleRegenerate}
                      disabled={busy}
                      className="flex-1 rounded-2xl border border-gray-200 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    >
                      {busy ? t("regenerating") : t("regenerateQr")}
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={readyForNextPayment}
                    className="w-full rounded-[28px] bg-[#050505] py-6 text-xl font-extrabold text-white shadow-[0px_25px_50px_-12px_rgba(0,0,0,0.2)]"
                  >
                    {t("newCharge")}
                  </button>
                </div>
              </>
            )}

            {pane === "paid" && result && receiptFields && (
              <PosPaidConfirmation
                amountDisplay={formatClpDisplay(result.amountClp)}
                currencyLabel={t("currencyLabel")}
                statusLabel={t("paidStatus")}
                hint={t("paidHint")}
                totalChargeLabel={t("totalCharge")}
              >
                {showReceipt ? (
                  <PosReceiptCard
                    fields={receiptFields}
                    labels={{
                      title: t("receiptTitle"),
                      amount: t("receiptAmount"),
                      time: t("receiptTime"),
                      paymentId: t("receiptPaymentId"),
                      reference: t("receiptReference"),
                    }}
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowReceipt(true)}
                    className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    {t("viewReceipt")}
                  </button>
                )}
                <button
                  type="button"
                  onClick={readyForNextPayment}
                  className="w-full rounded-[28px] bg-[#050505] py-6 text-xl font-extrabold text-white shadow-[0px_25px_50px_-12px_rgba(0,0,0,0.2)]"
                >
                  {t("newCharge")}
                </button>
              </PosPaidConfirmation>
            )}

            {pane === "expired" && result && (
              <>
                <div className="flex flex-col items-center gap-10">
                  <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-5 py-2">
                    <span className="size-2 rounded-full bg-amber-500" aria-hidden />
                    <span className="text-xs font-extrabold text-amber-700">
                      {t("expiredStatus")}
                    </span>
                  </div>

                  <div className="text-center">
                    <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#9ca3af]">
                      {t("totalCharge")}
                    </p>
                    <p className="mt-2 text-5xl font-extrabold tabular-nums text-[#050505]">
                      {formatClpDisplay(result.amountClp)}
                    </p>
                    <p className="mt-1 text-sm font-bold text-[#9ca3af]">{t("currencyLabel")}</p>
                    <p className="mt-4 max-w-xs text-sm text-amber-800">{t("expiredHint")}</p>
                  </div>
                </div>

                <div className="mt-8 flex flex-col gap-3">
                  {error && (
                    <p className="text-center text-sm text-red-600" role="alert">
                      {error}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={handleRegenerate}
                    disabled={busy}
                    className="w-full rounded-[28px] bg-[#050505] py-6 text-xl font-extrabold text-white shadow-[0px_25px_50px_-12px_rgba(0,0,0,0.2)] disabled:opacity-50"
                  >
                    {busy ? t("regenerating") : t("regenerateQr")}
                  </button>
                  <button
                    type="button"
                    onClick={readyForNextPayment}
                    className="w-full rounded-2xl border border-gray-200 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    {t("newCharge")}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
