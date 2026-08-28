"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  formatCycleLabel,
  formatReconciliationClp,
  type StoreReconciliationSummary,
} from "@/lib/store/reconciliation";

type StoreReconciliationPanelProps = {
  compact?: boolean;
};

export function StoreReconciliationPanel({ compact = false }: StoreReconciliationPanelProps) {
  const t = useTranslations("storeReconciliation");
  const [summary, setSummary] = useState<StoreReconciliationSummary | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/store/reconciliation", { credentials: "include", cache: "no-store" })
      .then(async (r) => {
        if (r.status === 403) return null;
        if (!r.ok) throw new Error(t("loadFailed"));
        return r.json() as Promise<StoreReconciliationSummary>;
      })
      .then((data) => {
        if (cancelled) return;
        setSummary(data);
      })
      .catch(() => {
        if (!cancelled) setError(t("loadFailed"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [t]);

  if (loading) {
    return (
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 animate-pulse h-24" />
    );
  }

  if (error) {
    return <p className="text-sm text-red-400">{error}</p>;
  }

  if (!summary) return null;

  const cycleLabel = formatCycleLabel(summary.cycleStartIso, summary.timeZone);

  return (
    <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
            {t("title")}
          </p>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t("subtitle")}</p>
        </div>
        <a
          href="/api/store/reconciliation?format=csv"
          className="rounded-md border border-gray-200 dark:border-gray-600 px-3 py-1.5 text-xs font-medium text-gray-800 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700"
        >
          {t("exportCsv")}
        </a>
      </div>
      <div className={`mt-4 grid gap-3 ${compact ? "sm:grid-cols-2" : "sm:grid-cols-3"}`}>
        <div>
          <p className="text-xs text-gray-500">{t("today")}</p>
          <p className="mt-0.5 text-lg font-semibold tabular-nums text-gray-900 dark:text-white">
            ${formatReconciliationClp(summary.todayClp)}{" "}
            <span className="text-sm font-medium text-gray-500">CLP</span>
          </p>
          <p className="text-[11px] text-gray-500">
            {t("chargeCount", { count: summary.todayChargeCount })}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500">{t("thisCycle", { from: cycleLabel })}</p>
          <p className="mt-0.5 text-lg font-semibold tabular-nums text-gray-900 dark:text-white">
            ${formatReconciliationClp(summary.cycleClp)}{" "}
            <span className="text-sm font-medium text-gray-500">CLP</span>
          </p>
          <p className="text-[11px] text-gray-500">
            {t("chargeCount", { count: summary.cycleChargeCount })}
          </p>
        </div>
        {!compact ? (
          <div>
            <p className="text-xs text-gray-500">{t("owedHintLabel")}</p>
            <p className="mt-0.5 text-sm text-gray-600 dark:text-gray-300">{t("owedHint")}</p>
          </div>
        ) : null}
      </div>
      {!compact && summary.charges.length > 0 ? (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500">
                <th className="py-2 pr-3 font-medium">{t("colDate")}</th>
                <th className="py-2 pr-3 font-medium">{t("colClp")}</th>
                <th className="py-2 font-medium">{t("colId")}</th>
              </tr>
            </thead>
            <tbody>
              {summary.charges.map((c) => (
                <tr key={c.id} className="border-t border-gray-200 dark:border-gray-700">
                  <td className="py-2 pr-3 text-gray-800 dark:text-gray-100">
                    {new Date(c.completedAt).toLocaleString("es-CL", {
                      timeZone: summary.timeZone,
                    })}
                  </td>
                  <td className="py-2 pr-3 tabular-nums text-gray-800 dark:text-gray-100">
                    ${formatReconciliationClp(c.amountClp)}
                  </td>
                  <td className="py-2 font-mono text-xs text-gray-500">{c.id}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
