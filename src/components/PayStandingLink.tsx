"use client";

import { useState } from "react";

export function PayStandingLink({
  slug,
  storeName,
  itemName,
  amountUsd,
}: {
  slug: string;
  storeName: string;
  itemName: string;
  amountUsd: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pay = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/pay/links/${encodeURIComponent(slug)}/start`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || typeof data.checkoutUrl !== "string") {
        setError(typeof data.error === "string" ? data.error : "No se pudo abrir el pago");
        setBusy(false);
        return;
      }
      window.location.assign(data.checkoutUrl);
    } catch {
      setError("No se pudo abrir el pago");
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-gray-50 dark:bg-gray-900">
      <div className="w-full max-w-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 text-center">
        <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
          {storeName}
        </p>
        <h1 className="mt-2 text-xl font-semibold text-gray-900 dark:text-white">{itemName}</h1>
        <p className="mt-4 text-3xl font-bold tabular-nums text-gray-900 dark:text-white">
          ${amountUsd}
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-400">USD</p>
        <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
          Este link se puede pagar más de una vez. Vas a recibir un comprobante en Sozu.
        </p>
        {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
        <button
          type="button"
          onClick={() => void pay()}
          disabled={busy}
          className="mt-6 w-full rounded-lg bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 px-5 py-2.5 text-sm font-medium disabled:opacity-50"
        >
          {busy ? "Abriendo…" : "Pagar"}
        </button>
      </div>
    </main>
  );
}
