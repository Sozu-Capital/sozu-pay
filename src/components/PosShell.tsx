"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { CheckoutPreviewCard } from "@/components/CheckoutPreviewCard";
import { LocalQrCode } from "@/components/LocalQrCode";
import {
  CHECKOUT_SETUP_WALLET_PATH,
  isCheckoutWalletNotReadyHttpStatus,
} from "@/lib/checkout/ready";
import { posPaneState } from "@/lib/dashboard/pos-pane";

type CreateResult = {
  checkoutUrl: string;
  id: string;
  amountUsd: string;
  reference: string | null;
};

export default function PosShell() {
  const t = useTranslations("posPage");
  const tc = useTranslations("checkoutPage");
  const [amountUsd, setAmountUsd] = useState("");
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CreateResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [walletReady, setWalletReady] = useState<boolean | null>(null);
  const [setupUrl, setSetupUrl] = useState(CHECKOUT_SETUP_WALLET_PATH);

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

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResult(null);
    const amount = parseFloat(amountUsd);
    if (!isFinite(amount) || amount <= 0) {
      setError(tc("invalidAmount"));
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/checkout/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amountUsd: amountUsd.trim(),
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
      const chargedAmount =
        typeof data.amountUsd === "string" && data.amountUsd.trim()
          ? data.amountUsd.trim()
          : amountUsd.trim();
      const chargedReference =
        typeof data.reference === "string" && data.reference.trim()
          ? data.reference.trim()
          : reference.trim() || null;
      setResult({
        checkoutUrl: data.checkoutUrl,
        id: data.id,
        amountUsd: chargedAmount,
        reference: chargedReference,
      });
    } finally {
      setBusy(false);
    }
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

  const pane = posPaneState({ amountUsd, hasResult: !!result });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
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
      <div className="grid gap-6 lg:grid-cols-2">
        <form
          onSubmit={handleCreate}
          className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 p-6 space-y-4"
        >
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              {tc("amountLabel")}
            </label>
            <div className="mt-1 flex items-center gap-2">
              <span className="text-lg font-semibold text-gray-500">$</span>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={amountUsd}
                onChange={(e) => setAmountUsd(e.target.value)}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-lg tabular-nums"
                placeholder="0.00"
                autoFocus
              />
              <span className="text-sm font-medium text-gray-500">USD</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              {tc("referenceLabel")}
            </label>
            <input
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
              placeholder={tc("referencePlaceholder")}
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold py-3 text-sm transition-colors"
          >
            {busy ? t("creating") : t("createCharge")}
          </button>

          <p className="text-xs text-gray-500 dark:text-gray-400">
            {t("managePoints")}{" "}
            <Link
              href="/dashboard/qr-codes"
              className="font-medium text-emerald-700 dark:text-emerald-400 underline-offset-2 hover:underline"
            >
              {t("managePointsLink")}
            </Link>
          </p>
        </form>

        <div className="space-y-4">
          {pane === "preview" && (
            <CheckoutPreviewCard amountUsd={amountUsd || "0.00"} reference={reference} />
          )}

          {pane === "ready" && result && (
            <div className="rounded-2xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 p-6 text-center">
              <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
                {t("readyTitle")}
              </p>
              <p className="mt-3 text-3xl font-bold tabular-nums text-gray-900 dark:text-white">
                ${result.amountUsd}
              </p>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">USD</p>
              {result.reference && (
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {t("chargedReference", { reference: result.reference })}
                </p>
              )}
              <LocalQrCode
                value={result.checkoutUrl}
                size={220}
                alt={t("qrAlt")}
                className="mx-auto mt-4 rounded-lg bg-white p-2"
              />
              <p className="mt-3 text-xs break-all text-gray-700 dark:text-gray-300">
                {result.checkoutUrl}
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <button
                  type="button"
                  onClick={() => copyLink(result.checkoutUrl)}
                  className="rounded-lg border border-emerald-400 dark:border-emerald-600 px-4 py-1.5 text-sm font-medium text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-800/40 transition-colors"
                >
                  {copied ? tc("copied") : tc("copyLink")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setResult(null);
                    setAmountUsd("");
                    setReference("");
                    setError(null);
                  }}
                  className="rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  {t("newCharge")}
                </button>
              </div>
            </div>
          )}

          {pane === "empty" && (
            <div className="rounded-2xl border border-dashed border-gray-300 dark:border-gray-600 p-8 text-center text-sm text-gray-500 dark:text-gray-400">
              {t("emptyHint")}
            </div>
          )}
        </div>
      </div>
      )}
    </div>
  );
}
