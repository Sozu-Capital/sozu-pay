"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { CashoutReleasePanel } from "@/components/CashoutReleasePanel";

type Withdrawal = {
  id: string;
  status: string;
  amount_usd: string;
  bank_account_holder: string;
  bank_country: string;
  bank_account_number: string;
  bank_currency: string | null;
  estimated_arrival: string | null;
  fiat_sent_at: string | null;
  created_at: string;
};

type BalanceData = { usdc: string; available: string };

export default function CashOutPage() {
  const t = useTranslations("cashOutPage");
  const [balance, setBalance] = useState<BalanceData | null>(null);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [loadingBalance, setLoadingBalance] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const [amountUsd, setAmountUsd] = useState("");
  const [bankAccountHolder, setBankAccountHolder] = useState("");
  const [bankCountry, setBankCountry] = useState("CL");
  const [bankAccountNumber, setBankAccountNumber] = useState("");
  const [bankRoutingCode, setBankRoutingCode] = useState("");
  const [bankCurrency, setBankCurrency] = useState("CLP");

  const [busy, setBusy] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadBalance = useCallback(() => {
    setLoadingBalance(true);
    fetch("/api/balance")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setBalance({ usdc: d.usdc ?? "0", available: d.available ?? "0" }))
      .finally(() => setLoadingBalance(false));
  }, []);

  const loadHistory = useCallback(() => {
    setLoadingHistory(true);
    fetch("/api/cashout")
      .then((r) => (r.ok ? r.json() : { withdrawals: [] }))
      .then((d) => setWithdrawals(d.withdrawals ?? []))
      .finally(() => setLoadingHistory(false));
  }, []);

  useEffect(() => {
    loadBalance();
    loadHistory();
  }, [loadBalance, loadHistory]);

  const activeWithdrawal = useMemo(
    () => withdrawals.find((w) => w.status === "pending" || w.status === "processing") ?? null,
    [withdrawals],
  );

  const activePending = activeWithdrawal?.status === "pending" ? activeWithdrawal : null;
  const awaitingRelease = activeWithdrawal?.status === "processing" ? activeWithdrawal : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (activeWithdrawal) {
      setError(t("pendingBlocksNew"));
      return;
    }

    const amount = parseFloat(amountUsd);
    if (!isFinite(amount) || amount <= 0) {
      setError(t("invalidAmount"));
      return;
    }
    if (!bankAccountHolder.trim() || !bankCountry.trim() || !bankAccountNumber.trim()) {
      setError(t("bankRequired"));
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/cashout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amountUsd: amountUsd.trim(),
          bankAccountHolder: bankAccountHolder.trim(),
          bankCountry: bankCountry.trim().toUpperCase(),
          bankAccountNumber: bankAccountNumber.trim(),
          bankRoutingCode: bankRoutingCode.trim() || undefined,
          bankCurrency: bankCurrency.trim().toUpperCase() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          data.code === "pending_exists"
            ? t("pendingBlocksNew")
            : ((data.error as string) ?? t("withdrawFailed")),
        );
        return;
      }
      setSuccess(t("withdrawQueuedNoEta"));
      setAmountUsd("");
      loadBalance();
      loadHistory();
    } finally {
      setBusy(false);
    }
  };

  const handleCancel = async (id: string) => {
    setCancellingId(id);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/cashout/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((data.error as string) ?? t("cancelFailed"));
        return;
      }
      setSuccess(t("cancelSuccess"));
      loadHistory();
    } finally {
      setCancellingId(null);
    }
  };

  const statusColor = (s: string) =>
    s === "completed"
      ? "text-emerald-600 dark:text-emerald-400"
      : s === "failed" || s === "cancelled"
        ? "text-gray-500 dark:text-gray-400"
        : "text-amber-600 dark:text-amber-400";

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t("title")}</h1>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t("subtitle")}</p>

      <div className="mt-6 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 p-5 flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            {t("availableBalance")}
          </p>
          {loadingBalance ? (
            <div className="mt-1 h-7 w-28 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
          ) : (
            <p className="mt-1 text-2xl font-bold">
              ${balance?.available ?? "0.00"}{" "}
              <span className="text-base font-normal text-gray-500">USDC</span>
            </p>
          )}
        </div>
      </div>

      {activePending && (
        <div className="mt-6 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 p-5">
          <p className="font-semibold text-amber-900 dark:text-amber-100">{t("pendingOpsTitle")}</p>
          <p className="mt-1 text-sm text-amber-800 dark:text-amber-200">{t("pendingOpsBody")}</p>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
            <span className="font-medium">${activePending.amount_usd} USDC</span>
            <span className="text-amber-700 dark:text-amber-300">{activePending.bank_account_holder}</span>
            <button
              type="button"
              disabled={cancellingId === activePending.id}
              onClick={() => handleCancel(activePending.id)}
              className="rounded-lg border border-amber-400 dark:border-amber-600 px-3 py-1.5 text-sm font-medium hover:bg-amber-100 dark:hover:bg-amber-900/40 disabled:opacity-50"
            >
              {cancellingId === activePending.id ? t("cancelling") : t("cancelRequest")}
            </button>
          </div>
        </div>
      )}

      {awaitingRelease && (
        <CashoutReleasePanel
          withdrawalId={awaitingRelease.id}
          amountUsd={awaitingRelease.amount_usd}
          fiatSentAt={awaitingRelease.fiat_sent_at}
          onReleased={() => {
            loadBalance();
            loadHistory();
          }}
        />
      )}

      <form
        onSubmit={handleSubmit}
        className="mt-6 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 p-6 space-y-4"
      >
        <h2 className="font-semibold text-gray-900 dark:text-white">{t("formTitle")}</h2>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t("amountLabel")}</label>
          <div className="flex items-center gap-2">
            <span className="text-gray-500">$</span>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={amountUsd}
              onChange={(e) => setAmountUsd(e.target.value)}
              placeholder="0.00"
              disabled={!!activeWithdrawal}
              className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet-500 disabled:opacity-60"
              required
            />
            <span className="text-sm text-gray-500">USDC</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t("holderLabel")}</label>
            <input
              type="text"
              value={bankAccountHolder}
              onChange={(e) => setBankAccountHolder(e.target.value)}
              placeholder={t("holderPlaceholder")}
              disabled={!!activeWithdrawal}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet-500 disabled:opacity-60"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t("countryLabel")}</label>
            <input
              type="text"
              maxLength={2}
              value={bankCountry}
              onChange={(e) => setBankCountry(e.target.value)}
              placeholder="CL"
              disabled={!!activeWithdrawal}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet-500 uppercase disabled:opacity-60"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t("currencyLabel")}</label>
            <input
              type="text"
              maxLength={3}
              value={bankCurrency}
              onChange={(e) => setBankCurrency(e.target.value)}
              placeholder="CLP"
              disabled={!!activeWithdrawal}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet-500 uppercase disabled:opacity-60"
            />
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t("accountNumberLabel")}</label>
            <input
              type="text"
              value={bankAccountNumber}
              onChange={(e) => setBankAccountNumber(e.target.value)}
              placeholder={t("accountNumberPlaceholder")}
              disabled={!!activeWithdrawal}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet-500 disabled:opacity-60"
              required
            />
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t("routingLabel")}</label>
            <input
              type="text"
              value={bankRoutingCode}
              onChange={(e) => setBankRoutingCode(e.target.value)}
              placeholder={t("routingPlaceholder")}
              disabled={!!activeWithdrawal}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet-500 disabled:opacity-60"
            />
          </div>
        </div>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        {success && <p className="text-sm text-emerald-600 dark:text-emerald-400">{success}</p>}

        <button
          type="submit"
          disabled={busy || !!activeWithdrawal}
          className="w-full rounded-lg bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white font-semibold py-2.5 text-sm transition-colors"
        >
          {busy ? t("submitting") : t("submitButton")}
        </button>

        <p className="text-xs text-gray-400 dark:text-gray-500 text-center">{t("hint")}</p>
      </form>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t("historyTitle")}</h2>
        {loadingHistory ? (
          <div className="mt-3 space-y-2">
            {[0, 1].map((i) => (
              <div key={i} className="h-10 rounded-lg bg-gray-100 dark:bg-gray-800 animate-pulse" />
            ))}
          </div>
        ) : withdrawals.length === 0 ? (
          <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">{t("noHistory")}</p>
        ) : (
          <div className="mt-3 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800/50">
                <tr>
                  <th className="text-left p-3 font-medium">{t("colDate")}</th>
                  <th className="text-left p-3 font-medium">{t("colAmount")}</th>
                  <th className="text-left p-3 font-medium">{t("colHolder")}</th>
                  <th className="text-left p-3 font-medium">{t("colStatus")}</th>
                </tr>
              </thead>
              <tbody>
                {withdrawals.map((w) => (
                  <tr key={w.id} className="border-t border-gray-200 dark:border-gray-700">
                    <td className="p-3 text-gray-600 dark:text-gray-400">
                      {new Date(w.created_at).toLocaleDateString()}
                    </td>
                    <td className="p-3 font-medium">${w.amount_usd}</td>
                    <td className="p-3 text-gray-600 dark:text-gray-400">{w.bank_account_holder}</td>
                    <td className={`p-3 font-medium capitalize ${statusColor(w.status)}`}>
                      {w.status === "cancelled" ? t("statusCancelled") : w.status}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
