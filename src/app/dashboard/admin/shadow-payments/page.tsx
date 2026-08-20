"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";

type OrderRow = {
  id: string;
  publicRef: string;
  orgId: string;
  amountClp: number;
  quotedUsdc: string;
  status: string;
  payerReference: string | null;
  createdAt: string;
};

type WithdrawalRow = {
  id: string;
  orgId: string;
  amountUsdc: string;
  note: string | null;
  status: string;
  createdAt: string;
};

type LpApiResponse = {
  configured: boolean;
  message?: string;
  publicKey?: string;
  usdcBalance?: string;
  stellarExpertUrl?: string;
  alertThresholdUsdc?: string | null;
  lowLiquidity?: boolean | null;
};

export default function ShadowPaymentsOraclePage() {
  const t = useTranslations("shadowOraclePage");
  const tc = useTranslations("common");
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRow[]>([]);
  const [lp, setLp] = useState<LpApiResponse | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [oRes, wRes, lpRes] = await Promise.all([
      fetch("/api/admin/shadow-ledger/orders"),
      fetch("/api/admin/shadow-ledger/withdrawals"),
      fetch("/api/admin/shadow-ledger/lp"),
    ]);
    if (oRes.status === 403 || wRes.status === 403 || lpRes.status === 403) {
      setForbidden(true);
      return;
    }
    const oData = await oRes.json().catch(() => ({}));
    const wData = await wRes.json().catch(() => ({}));
    const lpData = (await lpRes.json().catch(() => ({}))) as LpApiResponse;
    if (oData.orders) setOrders(oData.orders);
    if (wData.withdrawals) setWithdrawals(wData.withdrawals);
    if (lpRes.ok && typeof lpData.configured === "boolean") setLp(lpData);
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  const confirmOrder = async (orderId: string) => {
    setBusyId(orderId);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/shadow-ledger/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage((data.error as string) ?? t("confirmFailed"));
        return;
      }
      setMessage(
        data.alreadyConfirmed
          ? t("confirmAlready")
          : t("confirmSuccess", {
              credited: String(data.creditedUsdcMinor ?? "?"),
              balance: String(data.balanceAfterMinor ?? "—"),
            })
      );
      setOrders((prev) => prev.filter((o) => o.id !== orderId));
    } finally {
      setBusyId(null);
    }
  };

  const fulfillWithdrawal = async (requestId: string) => {
    setBusyId(requestId);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/shadow-ledger/withdrawals/fulfill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage((data.error as string) ?? t("fulfillFailed"));
        return;
      }
      setMessage(
        t("fulfillSuccess", { balance: String(data.balanceAfterMinor ?? "—") })
      );
      setWithdrawals((prev) => prev.filter((w) => w.id !== requestId));
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return <div className="text-gray-400">{tc("loading")}</div>;
  }

  if (forbidden) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-white">{t("title")}</h1>
        <p className="mt-2 text-red-400">{t("forbidden")}</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-white">{t("title")}</h1>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        {t("subtitle")}
      </p>

      {message && (
        <div className="mt-4 p-3 rounded-lg bg-gray-100 dark:bg-gray-800 text-sm text-gray-800 dark:text-gray-200">
          {message}
        </div>
      )}

      {lp?.configured && lp.publicKey && lp.stellarExpertUrl && (
        <div
          className={`mt-6 rounded-lg border p-4 text-sm ${
            lp.lowLiquidity
              ? "border-red-400/60 bg-red-950/30 text-red-100"
              : "border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300"
          }`}
        >
          <h2 className="font-semibold text-gray-900 dark:text-white">{t("lpTitle")}</h2>
          <p className="mt-1">
            {t("balance", { amount: lp.usdcBalance ?? "0" })}
          </p>
          <p className="mt-1 font-mono text-xs break-all opacity-80">{lp.publicKey}</p>
          <a
            href={lp.stellarExpertUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-block text-blue-600 dark:text-blue-400 hover:underline"
          >
            {t("viewExpert")}
          </a>
          {lp.lowLiquidity && lp.alertThresholdUsdc != null && (
            <p className="mt-2 text-red-200">
              {t("lowLiquidity", { threshold: lp.alertThresholdUsdc })}
            </p>
          )}
        </div>
      )}
      {lp && !lp.configured && lp.message && (
        <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">{lp.message}</p>
      )}

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t("pendingOrders")}</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-sm text-left">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 text-gray-500">
                <th className="py-2 pr-3">{t("colRef")}</th>
                <th className="py-2 pr-3">{t("colOrg")}</th>
                <th className="py-2 pr-3">{t("colClp")}</th>
                <th className="py-2 pr-3">{t("colUsdc")}</th>
                <th className="py-2 pr-3">{t("colPayerRef")}</th>
                <th className="py-2 pr-3">{t("colCreated")}</th>
                <th className="py-2">{t("colAction")}</th>
              </tr>
            </thead>
            <tbody className="text-gray-700 dark:text-gray-300">
              {orders.map((o) => (
                <tr key={o.id} className="border-b border-gray-100 dark:border-gray-800">
                  <td className="py-2 pr-3 font-mono text-xs">{o.publicRef}</td>
                  <td className="py-2 pr-3 font-mono text-xs">{o.orgId.slice(0, 8)}…</td>
                  <td className="py-2 pr-3">{o.amountClp}</td>
                  <td className="py-2 pr-3">{o.quotedUsdc}</td>
                  <td className="py-2 pr-3 max-w-[140px] truncate">{o.payerReference ?? "—"}</td>
                  <td className="py-2 pr-3 text-xs whitespace-nowrap">
                    {new Date(o.createdAt).toLocaleString()}
                  </td>
                  <td className="py-2">
                    <button
                      type="button"
                      disabled={busyId === o.id}
                      onClick={() => confirmOrder(o.id)}
                      className="rounded-md bg-green-700 px-3 py-1 text-xs font-medium text-white hover:bg-green-600 disabled:opacity-50"
                    >
                      {t("confirmPayment")}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {orders.length === 0 && (
            <p className="text-gray-500 text-sm py-4">{t("noPendingOrders")}</p>
          )}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t("pendingWithdrawals")}</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-sm text-left">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 text-gray-500">
                <th className="py-2 pr-3">{t("colOrg")}</th>
                <th className="py-2 pr-3">{t("colUsdc")}</th>
                <th className="py-2 pr-3">{t("colNote")}</th>
                <th className="py-2 pr-3">{t("colCreated")}</th>
                <th className="py-2">{t("colAction")}</th>
              </tr>
            </thead>
            <tbody className="text-gray-700 dark:text-gray-300">
              {withdrawals.map((w) => (
                <tr key={w.id} className="border-b border-gray-100 dark:border-gray-800">
                  <td className="py-2 pr-3 font-mono text-xs">{w.orgId.slice(0, 8)}…</td>
                  <td className="py-2 pr-3">{w.amountUsdc}</td>
                  <td className="py-2 pr-3 max-w-[200px] truncate">{w.note ?? "—"}</td>
                  <td className="py-2 pr-3 text-xs whitespace-nowrap">
                    {new Date(w.createdAt).toLocaleString()}
                  </td>
                  <td className="py-2">
                    <button
                      type="button"
                      disabled={busyId === w.id}
                      onClick={() => fulfillWithdrawal(w.id)}
                      className="rounded-md bg-blue-700 px-3 py-1 text-xs font-medium text-white hover:bg-blue-600 disabled:opacity-50"
                    >
                      {t("markFulfilled")}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {withdrawals.length === 0 && (
            <p className="text-gray-500 text-sm py-4">{t("noPendingWithdrawals")}</p>
          )}
        </div>
      </section>
    </div>
  );
}
