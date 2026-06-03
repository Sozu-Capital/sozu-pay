"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { TreasuryDistributionDonut } from "@/components/disbursements/TreasuryDistributionDonut";

type Balances = {
  configured: boolean;
  orgCombinedUsdc: string;
  treasuryUsdc: string;
  disbursementUsdc: string;
  distributionUsdc: string;
  distributionPublicKey: string | null;
  treasuryContractId: string | null;
  sweepBackEnabled: boolean;
};

type Props = {
  onBalancesChange?: (balances: Balances) => void;
};

export function DistributionTreasuryPanel({ onBalancesChange }: Props) {
  const t = useTranslations("disbursementsPage.distributionTreasury");

  const [balances, setBalances] = useState<Balances | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadBalances = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/treasury/distribution/balances", { credentials: "include" });
      const data = (await res.json().catch(() => ({}))) as Balances & { error?: string };
      if (!res.ok) {
        setError(data.error ?? t("loadFailed"));
        setBalances(null);
        return;
      }
      setBalances(data);
      onBalancesChange?.(data);
    } catch {
      setError(t("loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t, onBalancesChange]);

  useEffect(() => {
    void loadBalances();
  }, [loadBalances]);

  if (loading && !balances) {
    return (
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 text-sm text-gray-500">
        {t("loading")}
      </div>
    );
  }

  if (!balances?.configured) {
    return (
      <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-4 text-sm text-amber-800 dark:text-amber-300">
        {t("notConfigured")}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/40 p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{t("title")}</h3>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 max-w-xl">{t("donutSubtitle")}</p>
        </div>
        <Link
          href="/dashboard/audit"
          className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline shrink-0"
        >
          {t("viewHistory")}
        </Link>
      </div>

      <TreasuryDistributionDonut
        treasuryUsdc={balances.orgCombinedUsdc}
        distributionUsdc={balances.distributionUsdc}
      />

      {error ? (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export type { Balances as DistributionBalances };
