"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

type Props = {
  recipientName: string;
  onSuccess: (result: { id: string; estimatedArrival: string | null }) => void;
  onCancel: () => void;
};

export default function PaySupplierBankForm({ recipientName, onSuccess, onCancel }: Props) {
  const t = useTranslations("paySupplierBank");
  const [amountUsd, setAmountUsd] = useState("");
  const [bankAccountHolder, setBankAccountHolder] = useState(recipientName);
  const [bankCountry, setBankCountry] = useState("");
  const [bankAccountNumber, setBankAccountNumber] = useState("");
  const [bankRoutingCode, setBankRoutingCode] = useState("");
  const [bankCurrency, setBankCurrency] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const amount = parseFloat(amountUsd);
    if (!isFinite(amount) || amount <= 0) {
      setError(t("invalidAmount"));
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/payouts/bank", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amountUsd: amountUsd.trim(),
          recipientName,
          bankAccountHolder: bankAccountHolder.trim(),
          bankCountry: bankCountry.trim().toUpperCase(),
          bankAccountNumber: bankAccountNumber.trim(),
          bankRoutingCode: bankRoutingCode.trim() || undefined,
          bankCurrency: bankCurrency.trim().toUpperCase() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((data.error as string) ?? t("failed"));
        return;
      }
      onSuccess({ id: data.id, estimatedArrival: data.estimatedArrival ?? null });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-3 border-t border-gray-200 dark:border-gray-700 pt-4">
      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
        {t("title", { name: recipientName })}
      </p>

      <div className="flex items-center gap-2">
        <span className="text-gray-500 dark:text-gray-400 text-sm">$</span>
        <input
          type="number"
          min="0.01"
          step="0.01"
          value={amountUsd}
          onChange={(e) => setAmountUsd(e.target.value)}
          placeholder="0.00"
          className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          required
        />
        <span className="text-sm text-gray-500">USD</span>
      </div>

      <input
        type="text"
        value={bankAccountHolder}
        onChange={(e) => setBankAccountHolder(e.target.value)}
        placeholder={t("holderPlaceholder")}
        className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
        required
      />

      <div className="grid grid-cols-2 gap-2">
        <input
          type="text"
          maxLength={2}
          value={bankCountry}
          onChange={(e) => setBankCountry(e.target.value)}
          placeholder={t("countryPlaceholder")}
          className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 uppercase"
          required
        />
        <input
          type="text"
          maxLength={3}
          value={bankCurrency}
          onChange={(e) => setBankCurrency(e.target.value)}
          placeholder={t("currencyPlaceholder")}
          className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 uppercase"
        />
      </div>

      <input
        type="text"
        value={bankAccountNumber}
        onChange={(e) => setBankAccountNumber(e.target.value)}
        placeholder={t("accountNumberPlaceholder")}
        className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
        required
      />

      <input
        type="text"
        value={bankRoutingCode}
        onChange={(e) => setBankRoutingCode(e.target.value)}
        placeholder={t("routingPlaceholder")}
        className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
      />

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={busy}
          className="flex-1 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-2 text-sm transition-colors"
        >
          {busy ? t("sending") : t("sendButton")}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >
          {t("cancel")}
        </button>
      </div>
    </form>
  );
}
