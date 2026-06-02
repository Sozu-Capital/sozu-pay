"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useSmartAccountKitContext } from "@/components/SmartAccountKitProvider";
import { TreasuryDistributionDonut } from "@/components/disbursements/TreasuryDistributionDonut";
import {
  executePasskeyDistributionTransfer,
  type DistributionTransferDirection,
} from "@/lib/stellar/smartAccounts/executePasskeyDistributionTransfer";

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
  /** Refresh after transfer (e.g. re-run batch preflight). */
  onTransferred?: () => void;
  /** Called whenever balances refresh (for per-campaign funding hints). */
  onBalancesChange?: (balances: Balances) => void;
};

export function DistributionTreasuryPanel({ onTransferred, onBalancesChange }: Props) {
  const t = useTranslations("disbursementsPage.distributionTreasury");
  const { ready, kit } = useSmartAccountKitContext();

  const [balances, setBalances] = useState<Balances | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [transferring, setTransferring] = useState<DistributionTransferDirection | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

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
  }, [t]);

  useEffect(() => {
    void loadBalances();
  }, [loadBalances]);

  async function handleTransfer(direction: DistributionTransferDirection) {
    const trimmed = amount.trim();
    if (!trimmed || parseFloat(trimmed) <= 0) {
      setError(t("invalidAmount"));
      return;
    }
    if (!ready || !kit) {
      setError(t("kitNotReady"));
      return;
    }

    setTransferring(direction);
    setError(null);
    setSuccessMsg(null);

    try {
      const result = await executePasskeyDistributionTransfer({
        kit,
        direction,
        amount: trimmed,
      });
      setSuccessMsg(
        direction === "to_distribution"
          ? t("successToDistribution", { amount: result.amount, hash: result.stellarTxHash.slice(0, 12) })
          : t("successToTreasury", { amount: result.amount, hash: result.stellarTxHash.slice(0, 12) })
      );
      setAmount("");
      await loadBalances();
      onTransferred?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("transferFailed"));
    } finally {
      setTransferring(null);
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
        {t("notConfigured")}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/40 p-4 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{t("title")}</h3>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 max-w-xl">{t("subtitle")}</p>
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

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
        <div className="rounded-md bg-gray-50 dark:bg-gray-800/60 p-3">
          <p className="text-xs text-gray-500 dark:text-gray-400">{t("orgTreasury")}</p>
          <p className="font-semibold text-gray-900 dark:text-white">{balances.orgCombinedUsdc} USDC</p>
          {balances.treasuryContractId ? (
            <p className="text-[10px] text-gray-400 mt-1 truncate" title={balances.treasuryContractId}>
              {balances.treasuryContractId}
            </p>
          ) : null}
        </div>
        <div className="rounded-md bg-gray-50 dark:bg-gray-800/60 p-3">
          <p className="text-xs text-gray-500 dark:text-gray-400">{t("sdpDistribution")}</p>
          <p className="font-semibold text-gray-900 dark:text-white">{balances.distributionUsdc} USDC</p>
          {balances.distributionPublicKey ? (
            <p className="text-[10px] text-gray-400 mt-1 truncate" title={balances.distributionPublicKey}>
              {balances.distributionPublicKey}
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-xs text-gray-600 dark:text-gray-400">
          {t("amountLabel")}
          <input
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="12.00"
            className="rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white w-32"
          />
        </label>
        <button
          type="button"
          disabled={!!transferring || !ready}
          onClick={() => void handleTransfer("to_distribution")}
          className="rounded-md bg-indigo-600 text-white px-3 py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
        >
          {transferring === "to_distribution" ? t("transferring") : t("fundDistribution")}
        </button>
        <button
          type="button"
          disabled={!!transferring || !ready || !balances.sweepBackEnabled}
          title={!balances.sweepBackEnabled ? t("sweepBackDisabledHint") : undefined}
          onClick={() => void handleTransfer("to_treasury")}
          className="rounded-md border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50"
        >
          {transferring === "to_treasury" ? t("transferring") : t("sweepToTreasury")}
        </button>
      </div>

      {!balances.sweepBackEnabled ? (
        <p className="text-xs text-gray-500 dark:text-gray-400">{t("sweepBackDisabledHint")}</p>
      ) : null}

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
