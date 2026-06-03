"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useDashboardProfile } from "@/contexts/DashboardProfileContext";

export default function DashboardBalance() {
  const t = useTranslations("dashboardBalance");
  const ctx = useDashboardProfile();
  const loading = ctx?.loading ?? true;
  const data = ctx?.balance ?? null;
  const canManageDisbursements = ctx?.profile?.can_manage_disbursements === true;

  if (loading) return <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 animate-pulse h-24" />;

  const usdc = data?.usdc ?? "0";
  const fiatAmount = data?.fiatAmount ?? "0.00";
  const fiatCurrency = data?.fiatCurrency ?? "USD";
  const rateSource = data?.rateSource ?? "—";
  const inVault = data?.inVault ?? "0";
  const distributionUsdc = data?.distributionUsdc ?? "0";
  const showDistribution =
    canManageDisbursements && (data?.sdpDistributionConfigured ?? false);

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 p-6">
      <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
        {t("title")}
      </h2>
      <p className="mt-2 text-2xl font-bold">{usdc} USDC</p>
      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{t("treasurySub")}</p>
      <p className="mt-2 text-gray-600 dark:text-gray-400">
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
      {showDistribution ? (
        <div className="mt-5 pt-4 border-t border-gray-200 dark:border-gray-700">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            {t("distributionLabel")}
          </p>
          <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-white tabular-nums">
            {distributionUsdc} USDC
          </p>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{t("distributionSub")}</p>
          <Link
            href="/dashboard/disbursements"
            className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
          >
            {t("viewDisbursements")}
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      ) : null}
    </div>
  );
}
