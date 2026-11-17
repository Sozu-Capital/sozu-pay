"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import ReceiptModal, { ReceiptSession } from "@/components/ReceiptModal";
import { StoreReconciliationPanel } from "@/components/StoreReconciliationPanel";
import { useDashboardProfile } from "@/contexts/DashboardProfileContext";

interface Tx {
  id: string;
  date: string;
  amount: string;
  type: string;
  source: string;
  status: string;
  stellarExpertUrl: string;
}

export default function TransactionsPage() {
  const t = useTranslations("transactionsPage");
  const [list, setList] = useState<Tx[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedTx, setSelectedTx] = useState<Tx | null>(null);
  const [checkoutSession, setCheckoutSession] = useState<ReceiptSession | null>(null);
  const [loadingCheckout, setLoadingCheckout] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const profileCtx = useDashboardProfile();
  const orgName = profileCtx?.profile?.org_name ?? null;
  const isStore = profileCtx?.profile?.org_type === "store";

  const handleRowClick = async (tx: Tx) => {
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

  useEffect(() => {
    fetch("/api/transactions?limit=50")
      .then((r) => (r.ok ? r.json() : { transactions: [] }))
      .then((d) => setList(d.transactions ?? []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold text-white">{t("title")}</h1>
      <p className="mt-1 text-gray-600 dark:text-gray-400">
        {t("subtitle")}
      </p>
      {isStore ? (
        <div className="mt-6">
          <StoreReconciliationPanel />
        </div>
      ) : null}
      {loading ? (
        <div className="mt-6 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="animate-pulse h-12 bg-gray-100 dark:bg-gray-800" />
          <div className="animate-pulse h-12 bg-gray-50 dark:bg-gray-800/50" />
          <div className="animate-pulse h-12 bg-gray-100 dark:bg-gray-800" />
        </div>
      ) : list.length === 0 ? (
        <p className="mt-6 text-gray-500 dark:text-gray-400">{t("empty")}</p>
      ) : (
        <div className="mt-6 rounded-lg border border-gray-200 dark:border-gray-700 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800/50">
              <tr>
                <th className="text-left p-3 font-medium">{t("columns.date")}</th>
                <th className="text-left p-3 font-medium">{t("columns.amount")}</th>
                <th className="text-left p-3 font-medium">{t("columns.type")}</th>
                <th className="text-left p-3 font-medium">{t("columns.source")}</th>
                <th className="text-left p-3 font-medium">{t("columns.status")}</th>
                <th className="text-left p-3 font-medium">{t("columns.stellarExpert")}</th>
              </tr>
            </thead>
            <tbody>
              {list.map((tx) => (
                <tr
                  key={tx.id}
                  onClick={() => handleRowClick(tx)}
                  className="border-t border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors"
                >
                  <td className="p-3">
                    {new Date(tx.date).toLocaleDateString()}
                  </td>
                  <td className="p-3">{tx.amount} USDC</td>
                  <td className="p-3 capitalize">{tx.type}</td>
                  <td className="p-3">{tx.source}</td>
                  <td className="p-3 capitalize">{tx.status}</td>
                  <td className="p-3">
                    <a
                      href={tx.stellarExpertUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      {t("view")}
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

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
