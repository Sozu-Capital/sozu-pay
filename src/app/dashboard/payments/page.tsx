"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";

type OrderRow = {
  id: string;
  publicRef: string;
  amountClp: number;
  quotedUsdc: string;
  status: string;
  createdAt: string;
};

type Summary = {
  initialized?: boolean;
  ledgerAvailableUsdc?: string;
  pendingOrders?: OrderRow[];
  recentOrders?: OrderRow[];
  withdrawalRequests?: { id: string; amountUsdc: string; status: string; note: string | null; createdAt: string }[];
  transactions?: {
    id: string;
    type: string;
    amountUsdc: string;
    signed: string;
    memo: string | null;
    createdAt: string;
  }[];
  error?: string;
  hint?: string;
};

export default function PaymentsPocPage() {
  const t = useTranslations("paymentsPocPage");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [amountClp, setAmountClp] = useState("");
  const [payerRef, setPayerRef] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawNote, setWithdrawNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch("/api/payments/ledger-summary")
      .then((r) => r.json())
      .then(setSummary);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const createPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    const n = Number.parseFloat(amountClp);
    if (!Number.isFinite(n) || n <= 0) {
      setMessage(t("invalidClp"));
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/payments/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amountClp: n,
          payerReference: payerRef.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage((data.error as string) ?? (data.hint as string) ?? t("createFailed"));
        return;
      }
      setMessage(
        t("orderCreated", {
          ref: String(data.order?.publicRef ?? ""),
          usdc: String(data.order?.quotedUsdc ?? ""),
          instructions: String(data.paymentInstructions ?? ""),
        })
      );
      setAmountClp("");
      setPayerRef("");
      load();
    } finally {
      setBusy(false);
    }
  };

  const requestWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setBusy(true);
    try {
      const res = await fetch("/api/payments/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amountUsdc: withdrawAmount.trim(),
          note: withdrawNote.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage((data.error as string) ?? t("withdrawFailed"));
        return;
      }
      setMessage((data.message as string) ?? t("withdrawQueued"));
      setWithdrawAmount("");
      setWithdrawNote("");
      load();
    } finally {
      setBusy(false);
    }
  };

  if (summary?.error && summary.hint) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-white">{t("title")}</h1>
        <p className="mt-2 text-amber-200 text-sm">{summary.error}</p>
        <p className="mt-1 text-gray-400 text-sm">{summary.hint}</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t("title")}</h1>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        {t("subtitle")}
      </p>

      {message && (
        <div className="mt-4 p-3 rounded-lg bg-gray-100 dark:bg-gray-800 text-sm text-gray-800 dark:text-gray-200">
          {message}
        </div>
      )}

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <section className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t("ledgerBalance")}</h2>
          <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">
            {summary?.ledgerAvailableUsdc ?? "—"} USDC
          </p>
          <p className="mt-1 text-xs text-gray-500">{t("ledgerOnly")}</p>
        </section>

        <section className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t("newOrder")}</h2>
          <form onSubmit={createPayment} className="mt-3 space-y-3">
            <label className="block text-sm text-gray-600 dark:text-gray-400">
              {t("amountClp")}
              <input
                type="text"
                inputMode="decimal"
                value={amountClp}
                onChange={(e) => setAmountClp(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-gray-900 dark:text-white"
                placeholder="10000"
              />
            </label>
            <label className="block text-sm text-gray-600 dark:text-gray-400">
              {t("payerRef")}
              <input
                type="text"
                value={payerRef}
                onChange={(e) => setPayerRef(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-gray-900 dark:text-white"
              />
            </label>
            <button
              type="submit"
              disabled={busy}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {t("createOrder")}
            </button>
          </form>
        </section>
      </div>

      <section className="mt-8 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t("withdrawSection")}</h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {t("withdrawHelp")}
        </p>
        <form onSubmit={requestWithdraw} className="mt-3 flex flex-wrap gap-3 items-end">
          <label className="text-sm text-gray-600 dark:text-gray-400">
            {t("withdrawAmount")}
            <input
              type="text"
              inputMode="decimal"
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value)}
              className="mt-1 block w-40 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-gray-900 dark:text-white"
              placeholder="10.5"
            />
          </label>
          <label className="text-sm text-gray-600 dark:text-gray-400 flex-1 min-w-[200px]">
            {t("note")}
            <input
              type="text"
              value={withdrawNote}
              onChange={(e) => setWithdrawNote(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-gray-900 dark:text-white"
              placeholder={t("notePlaceholder")}
            />
          </label>
          <button
            type="submit"
            disabled={busy}
            className="rounded-md border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-medium text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50"
          >
            {t("queueWithdrawal")}
          </button>
        </form>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t("orders")}</h2>
        <div className="mt-2 overflow-x-auto">
          <table className="min-w-full text-sm text-left text-gray-600 dark:text-gray-300">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="py-2 pr-4">{t("colRef")}</th>
                <th className="py-2 pr-4">{t("colClp")}</th>
                <th className="py-2 pr-4">{t("colUsdc")}</th>
                <th className="py-2 pr-4">{t("colStatus")}</th>
                <th className="py-2">{t("colCreated")}</th>
              </tr>
            </thead>
            <tbody>
              {(summary?.recentOrders ?? []).map((o) => (
                <tr key={o.id} className="border-b border-gray-100 dark:border-gray-800">
                  <td className="py-2 pr-4 font-mono text-xs">{o.publicRef}</td>
                  <td className="py-2 pr-4">{o.amountClp}</td>
                  <td className="py-2 pr-4">{o.quotedUsdc}</td>
                  <td className="py-2 pr-4">{o.status}</td>
                  <td className="py-2 text-xs">{new Date(o.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {(summary?.recentOrders?.length ?? 0) === 0 && (
            <p className="text-gray-500 text-sm py-4">{t("noOrders")}</p>
          )}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t("withdrawalRequests")}</h2>
        <ul className="mt-2 space-y-2 text-sm text-gray-600 dark:text-gray-400">
          {(summary?.withdrawalRequests ?? []).map((w) => (
            <li key={w.id} className="flex flex-wrap gap-2 border-b border-gray-100 dark:border-gray-800 pb-2">
              <span>{w.amountUsdc} USDC</span>
              <span className="text-gray-500">{w.status}</span>
              <span className="text-xs">{new Date(w.createdAt).toLocaleString()}</span>
              {w.note && <span className="w-full text-xs">{w.note}</span>}
            </li>
          ))}
        </ul>
        {(summary?.withdrawalRequests?.length ?? 0) === 0 && (
          <p className="text-gray-500 text-sm py-2">{t("none")}</p>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t("ledgerTx")}</h2>
        <ul className="mt-2 space-y-2 text-sm">
          {(summary?.transactions ?? []).map((tx) => (
            <li
              key={tx.id}
              className="border-b border-gray-100 dark:border-gray-800 pb-2 text-gray-600 dark:text-gray-400"
            >
              <span className={tx.signed === "credit" ? "text-green-600 dark:text-green-400" : "text-orange-600 dark:text-orange-400"}>
                {tx.signed === "credit" ? "+" : "-"}
                {tx.amountUsdc} USDC
              </span>
              <span className="ml-2 text-gray-500">{tx.type}</span>
              <span className="ml-2 text-xs">{new Date(tx.createdAt).toLocaleString()}</span>
              {tx.memo && <p className="text-xs text-gray-500 mt-1">{tx.memo}</p>}
            </li>
          ))}
        </ul>
        {(summary?.transactions?.length ?? 0) === 0 && (
          <p className="text-gray-500 text-sm py-2">{t("noLedgerTx")}</p>
        )}
      </section>
    </div>
  );
}
