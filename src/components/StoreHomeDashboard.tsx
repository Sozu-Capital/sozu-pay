"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import DashboardTransactions from "@/components/DashboardTransactions";
import { useDashboardProfile } from "@/contexts/DashboardProfileContext";
import { storeHomeActions, type StoreHomeActionKind } from "@/lib/dashboard/nav-links";

const ACTION_LABEL_KEY: Record<StoreHomeActionKind, string> = {
  pos: "actionPOS",
  "qr-codes": "actionQrAndNfc",
  send: "actionSend",
  "pay-supplier": "actionPaySupplier",
  "cash-out": "actionCashOut",
};

function ActionIcon({ kind }: { kind: StoreHomeActionKind }) {
  if (kind === "pos") {
    return (
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/40">
        <svg className="h-5 w-5 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l6-6m-3 3h.01M4 7h16M4 17h16M7 7V5a1 1 0 011-1h8a1 1 0 011 1v2" />
        </svg>
      </span>
    );
  }
  if (kind === "qr-codes") {
    return (
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900/40">
        <svg className="h-5 w-5 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
        </svg>
      </span>
    );
  }
  if (kind === "pay-supplier") {
    return (
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/40">
        <svg className="h-5 w-5 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
        </svg>
      </span>
    );
  }
  if (kind === "send") {
    return (
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/40">
        <svg className="h-5 w-5 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
        </svg>
      </span>
    );
  }
  return (
    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-100 dark:bg-violet-900/40">
      <svg className="h-5 w-5 text-violet-600 dark:text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
      </svg>
    </span>
  );
}

export default function StoreHomeDashboard() {
  const t = useTranslations("storeDashboard");
  const ctx = useDashboardProfile();
  const loading = ctx?.loading ?? true;
  const raw = ctx?.balance ?? null;

  const balance = raw ? {
    usdc: raw.usdc,
    available: raw.available,
    localFiatAmount: raw.localFiatAmount ?? raw.fiatAmount ?? "0.00",
    localFiatCurrency: raw.localFiatCurrency ?? raw.fiatCurrency ?? "USD",
    rateSource: raw.rateSource ?? "",
  } : null;

  // USDC is always 1:1 with USD — show as dollars
  const usdBalance = parseFloat(balance?.usdc ?? "0").toFixed(2);
  const showLocalFiat = balance && balance.localFiatCurrency !== "USD";
  const actions = storeHomeActions();

  return (
    <div className="space-y-8">
      {/* Balance hero */}
      <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 p-8">
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          {t("balanceLabel")}
        </p>
        {loading ? (
          <div className="mt-3 h-10 w-48 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
        ) : (
          <>
            <p className="mt-2 text-4xl font-bold tracking-tight tabular-nums">
              ${usdBalance}{" "}
              <span className="text-2xl font-medium text-gray-500 dark:text-gray-400">
                USD
              </span>
            </p>
            {showLocalFiat && (
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {t("estimatedIn", {
                  amount: balance!.localFiatAmount,
                  currency: balance!.localFiatCurrency,
                })}
              </p>
            )}
            {balance?.rateSource && (
              <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                {balance.rateSource}
              </p>
            )}
          </>
        )}

        {/* Quick actions — POS is the only create-charge CTA */}
        <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {actions.map((action) => (
            <Link
              key={action.kind}
              href={action.href}
              className="flex flex-col items-center gap-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-4 py-5 text-center hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <ActionIcon kind={action.kind} />
              <span className="text-sm font-medium">{t(ACTION_LABEL_KEY[action.kind])}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent transactions */}
      <section>
        <DashboardTransactions />
      </section>
    </div>
  );
}
