"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useDashboardProfile } from "@/contexts/DashboardProfileContext";
import ReceiptModal, { ReceiptSession, ReceiptTransaction } from "@/components/ReceiptModal";

export default function DashboardTransactions() {
  const t = useTranslations("dashboardTransactionsWidget");
  const ctx = useDashboardProfile();
  const { profile } = ctx ?? { profile: null };
  const isStore = profile?.org_type === "store";
  const loading = ctx?.loading ?? true;
  const list = ctx?.transactions ?? [];

  const [selectedTx, setSelectedTx] = useState<ReceiptTransaction | null>(null);
  const [checkoutSession, setCheckoutSession] = useState<ReceiptSession | null>(null);
  const [loadingCheckout, setLoadingCheckout] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const orgName = profile?.org_name ?? null;

  const handleRowClick = async (tx: ReceiptTransaction) => {
    setSelectedTx(tx);
    setCheckoutSession(null);
    setShowModal(true);
    setLoadingCheckout(true);
    try {
      const res = await fetch(`/api/checkout/by-tx?txHash=${tx.id}`);
      if (res.ok) {
        const data = await res.json();
        setCheckoutSession(data);
      }
    } catch (err) {
      console.error("Error looking up checkout by tx:", err);
    } finally {
      setLoadingCheckout(false);
    }
  };

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
                <tr
                  key={tx.id}
                  onClick={() => handleRowClick(tx)}
                  className="border-t border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors"
                >
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
                        onClick={(e) => e.stopPropagation()}
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

      <ReceiptModal
        open={showModal}
        onClose={() => setShowModal(false)}
        checkoutSession={checkoutSession}
        transaction={selectedTx}
        orgName={orgName}
        loading={loadingCheckout}
      />
    </div>
  );
}
