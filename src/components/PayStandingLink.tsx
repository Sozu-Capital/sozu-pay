"use client";

import { useState } from "react";

export function PayStandingLink({
  slug,
  storeSlug,
  storeName,
  itemName,
  amountUsd,
  collectibleReceipt = false,
  editionSize = null,
  oneShot = false,
  directWalletCheckoutUrl,
}: {
  slug: string;
  /** Store segment of /pay/qr/{store}/{slug}. Omitted for a one-shot checkout screen. */
  storeSlug?: string;
  storeName: string;
  itemName: string;
  amountUsd: string;
  collectibleReceipt?: boolean;
  /** Shared URL for a numbered run. Each sale takes one number, 1/N through N/N. */
  editionSize?: number | null;
  /** POS sale: payable once. Collectibles stay off. */
  oneShot?: boolean;
  /** Existing checkout. Skips minting another session. */
  directWalletCheckoutUrl?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pay = async () => {
    if (directWalletCheckoutUrl) {
      window.location.assign(directWalletCheckoutUrl);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const startPath = storeSlug
        ? `/api/pay/links/${encodeURIComponent(storeSlug)}/${encodeURIComponent(slug)}/start`
        : `/api/pay/links/${encodeURIComponent(slug)}/start`;
      const res = await fetch(startPath, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      const checkoutUrl =
        typeof data.checkoutUrl === "string"
          ? data.checkoutUrl
          : typeof data.walletCheckoutUrl === "string"
            ? data.walletCheckoutUrl
            : null;
      if (!res.ok || !checkoutUrl) {
        setError(typeof data.error === "string" ? data.error : "No se pudo abrir el pago");
        setBusy(false);
        return;
      }
      window.location.assign(checkoutUrl);
    } catch {
      setError("No se pudo abrir el pago");
      setBusy(false);
    }
  };

  const note = oneShot
    ? "Este cobro se paga una sola vez. Vas a recibir un comprobante en Sozu."
    : collectibleReceipt && editionSize
      ? `Este link es el mismo para las ${editionSize} prendas. Cada venta crea un coleccionable único con el número de esa prenda, del 1/${editionSize} al ${editionSize}/${editionSize}.`
      : collectibleReceipt
        ? "Este link se puede pagar más de una vez. Vas a recibir un comprobante coleccionable en Sozu."
        : "Este link se puede pagar más de una vez. Vas a recibir un comprobante en Sozu.";

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
        <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">{note}</p>
        {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
        <button
          type="button"
          onClick={() => void pay()}
          disabled={busy}
          className="mt-6 w-full rounded-lg bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 px-5 py-2.5 text-sm font-medium disabled:opacity-50"
        >
          {busy ? "Abriendo…" : "Pagar con Sozu"}
        </button>
      </div>
    </main>
  );
}
