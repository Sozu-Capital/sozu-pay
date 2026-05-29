"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

type LedgerSummary = {
  initialized?: boolean;
  ledgerAvailableUsdc?: string;
  error?: string;
  hint?: string;
};

export default function LedgerShadowBalance() {
  const t = useTranslations("ledgerShadowBalance");
  const [data, setData] = useState<LedgerSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/payments/ledger-summary")
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 animate-pulse h-24" />
    );
  }

  if (data?.error === "Shadow ledger not initialized" || data?.hint) {
    return (
      <div className="rounded-lg border border-amber-200 dark:border-amber-900/40 bg-amber-50/50 dark:bg-amber-950/20 p-4 text-sm text-amber-900 dark:text-amber-200">
        <p className="font-medium">{t("titlePoc")}</p>
        <p className="mt-1 text-amber-800/90 dark:text-amber-300/90">
          {t("initBody")}
        </p>
      </div>
    );
  }

  const usdc = data?.ledgerAvailableUsdc ?? "0";

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 p-6">
      <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
        {t("title")}
      </h2>
      <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">{usdc} USDC</p>
      <p className="mt-1 text-xs text-gray-500 dark:text-gray-500">
        {t("footnote")}
      </p>
      <Link
        href="/dashboard/disbursements"
        className="mt-3 inline-block text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
      >
        {t("link")}
      </Link>
    </div>
  );
}
