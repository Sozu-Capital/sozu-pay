"use client";

import { useState } from "react";

export function NamedCheckoutPayButton({
  storeSlug,
  checkoutSlug,
}: {
  storeSlug: string;
  checkoutSlug: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function pay() {
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/checkout/named/pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ store: storeSlug, checkout: checkoutSlug }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (typeof data.redirect === "string") {
          window.location.assign(data.redirect);
          return;
        }
        throw new Error(typeof data.error === "string" ? data.error : "Payment unavailable");
      }
      if (typeof data.checkoutUrl === "string") {
        window.location.assign(data.checkoutUrl);
        return;
      }
      throw new Error("Payment unavailable");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment unavailable");
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 space-y-2">
      <button
        type="button"
        onClick={() => void pay()}
        disabled={busy}
        className="w-full rounded-lg bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 px-5 py-2.5 text-sm font-semibold disabled:opacity-60"
      >
        {busy ? "Starting payment…" : "Pay"}
      </button>
      {error ? (
        <p className="text-center text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
