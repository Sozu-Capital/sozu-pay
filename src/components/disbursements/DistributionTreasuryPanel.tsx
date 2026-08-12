"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { TreasuryDistributionDonut } from "@/components/disbursements/TreasuryDistributionDonut";
import { useSmartAccountKitContext } from "@/components/SmartAccountKitProvider";
import { executePasskeyDistributionTransfer } from "@/lib/stellar/smartAccounts/executePasskeyDistributionTransfer";

function formatSweepAmount(raw: string): string {
  const n = parseFloat(raw);
  if (!Number.isFinite(n) || n <= 0) return "";
  return n.toFixed(7).replace(/\.?0+$/, "");
}

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
  const { ready: kitReady, kit, credentialId } = useSmartAccountKitContext();

  const [balances, setBalances] = useState<Balances | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [sweeping, setSweeping] = useState(false);

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

  const distributionAmount = balances ? formatSweepAmount(balances.distributionUsdc) : "";
  const canSweep =
    Boolean(balances?.sweepBackEnabled) &&
    Boolean(distributionAmount) &&
    kitReady &&
    !sweeping;

  async function handleSweepToTreasury() {
    if (!kit || !balances) return;
    const amount = formatSweepAmount(balances.distributionUsdc);
    if (!amount) {
      setError(t("noDistributionBalance"));
      return;
    }
    if (!balances.sweepBackEnabled) {
      setError(t("sweepBackDisabledHint"));
      return;
    }
    if (!kitReady) {
      setError(t("kitNotReady"));
      return;
    }

    setSweeping(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const result = await executePasskeyDistributionTransfer({
        kit,
        credentialId,
        direction: "to_treasury",
        amount,
      });
      setSuccessMsg(
        t("successToTreasury", {
          amount: result.amount,
          hash: result.stellarTxHash.slice(0, 12),
        })
      );
      await loadBalances();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("transferFailed"));
    } finally {
      setSweeping(false);
    }
  }

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
        {balances?.distributionPublicKey ? t("orgTreasuryMissing") : t("notConfigured")}
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

      <div className="flex flex-wrap items-center gap-3 pt-1">
        <button
          type="button"
          onClick={() => void handleSweepToTreasury()}
          disabled={!canSweep}
          title={
            !balances.sweepBackEnabled
              ? t("sweepBackDisabledHint")
              : !distributionAmount
                ? t("noDistributionBalance")
                : undefined
          }
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {sweeping ? t("transferring") : t("sweepToTreasury")}
        </button>
        {distributionAmount ? (
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {t("sweepAvailable", { amount: distributionAmount })}
          </span>
        ) : null}
      </div>

      {successMsg ? (
        <p className="text-sm text-green-700 dark:text-green-400" role="status">
          {successMsg}
        </p>
      ) : null}

      {error ? (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export type { Balances as DistributionBalances };
