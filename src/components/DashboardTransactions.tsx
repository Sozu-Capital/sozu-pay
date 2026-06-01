"use client";

import { useTranslations } from "next-intl";
import { useDashboardProfile } from "@/contexts/DashboardProfileContext";

export default function DashboardTransactions() {
  const t = useTranslations("dashboardTransactionsWidget");
  const ctx = useDashboardProfile();
  const { profile } = ctx ?? { profile: null };
  const isStore = profile?.org_type === "store";
  const loading = ctx?.loading ?? true;
  const list = ctx?.transactions ?? [];

  const formatAmount = (amount: string) =>
    isStore
      ? `$${parseFloat(amount).toFixed(2)}`
      : `${amount} USDC`;

  const humanType = (type: string) => {
    if (isStore) {
      if (type === "payment" || type === "receive") return t("typePaymentIn");
      if (type === "payout" || type === "send") return t("typePaymentOut");
      if (type === "withdrawal") return t("typeWithdrawal");
    }
    return type;
  };

  return (
    <div>
      <h2 className="text-lg font-semibold">{t(isStore ? "storeTitle" : "title")}</h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
        {t(isStore ? "storeSubtitle" : "subtitle")}
      </p>
      {loading ? (
        <div className="mt-4 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="animate-pulse h-12 bg-gray-100 dark:bg-gray-800" />
          <div className="animate-pulse h-12 bg-gray-50 dark:bg-gray-800/50" />
          <div className="animate-pulse h-12 bg-gray-100 dark:bg-gray-800" />
        </div>
      ) : list.length === 0 ? (
        <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
          {t("empty")}
        </p>
      ) : (
        <div className="mt-4 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800/50">
              <tr>
                <th className="text-left p-3 font-medium">{t("columns.date")}</th>
                <th className="text-left p-3 font-medium">{t("columns.amount")}</th>
                <th className="text-left p-3 font-medium">{t("columns.type")}</th>
                {!isStore && <th className="text-left p-3 font-medium">{t("columns.source")}</th>}
                {!isStore && <th className="text-left p-3 font-medium">{t("columns.link")}</th>}
              </tr>
            </thead>
            <tbody>
              {list.map((tx) => (
                <tr key={tx.id} className="border-t border-gray-200 dark:border-gray-700">
                  <td className="p-3 text-gray-600 dark:text-gray-400">
                    {new Date(tx.date).toLocaleDateString()}
                  </td>
                  <td className="p-3 font-medium tabular-nums">{formatAmount(tx.amount)}</td>
                  <td className="p-3 capitalize text-gray-700 dark:text-gray-300">
                    {humanType(tx.type)}
                  </td>
                  {!isStore && <td className="p-3 text-gray-600 dark:text-gray-400">{tx.source}</td>}
                  {!isStore && (
                    <td className="p-3">
                      <a
                        href={tx.stellarExpertUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        {t("stellarExpert")}
                      </a>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <a
        href="/dashboard/transactions"
        className="inline-block mt-3 text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
      >
        {t("viewAll")}
      </a>
    </div>
  );
}
