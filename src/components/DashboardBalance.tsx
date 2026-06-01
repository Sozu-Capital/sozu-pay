"use client";

import { useTranslations } from "next-intl";
import { useDashboardProfile } from "@/contexts/DashboardProfileContext";

export default function DashboardBalance() {
  const t = useTranslations("dashboardBalance");
  const ctx = useDashboardProfile();
  const loading = ctx?.loading ?? true;
  const data = ctx?.balance ?? null;

  if (loading) return <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 animate-pulse h-24" />;

  const usdc = data?.usdc ?? "0";
  const fiatAmount = data?.fiatAmount ?? "0.00";
  const fiatCurrency = data?.fiatCurrency ?? "USD";
  const rateSource = data?.rateSource ?? "—";
  const inVault = data?.inVault ?? "0";

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 p-6">
      <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
        {t("title")}
      </h2>
      <p className="mt-2 text-2xl font-bold">{usdc} USDC</p>
      <p className="mt-1 text-gray-600 dark:text-gray-400">
        {fiatAmount} {fiatCurrency}
      </p>
      <p className="mt-2 text-xs text-gray-500 dark:text-gray-500">
        {rateSource}
      </p>
      {parseFloat(inVault) > 0 && (
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          {t("inVault", { amount: inVault })}
        </p>
      )}
    </div>
  );
}
