"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

export default function StubRampCheckoutPage() {
  const sp = useSearchParams();
  const [busy, setBusy] = useState(false);

  const data = useMemo(() => {
    const ref = sp.get("ref") ?? "";
    const session = sp.get("session") ?? "";
    const amount = sp.get("amount") ?? "";
    const redirect = sp.get("redirect") ?? "";
    return { ref, session, amount, redirect };
  }, [sp]);

  const goBack = () => {
    if (!data.redirect) return;
    try {
      const url = decodeURIComponent(data.redirect);
      window.location.href = url;
    } catch {
      window.location.href = "/dashboard/checkout";
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-gray-50 dark:bg-gray-950">
      <div className="w-full max-w-lg rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Ramp checkout (stub)</h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          This is a local stub checkout page for development. No real payment is processed.
        </p>

        <div className="mt-4 rounded-lg bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 p-4">
          <dl className="grid grid-cols-3 gap-2 text-sm">
            <dt className="text-gray-500 dark:text-gray-400">Ref</dt>
            <dd className="col-span-2 font-mono text-xs break-all text-gray-800 dark:text-gray-200">
              {data.ref || "—"}
            </dd>
            <dt className="text-gray-500 dark:text-gray-400">Session</dt>
            <dd className="col-span-2 font-mono text-xs break-all text-gray-800 dark:text-gray-200">
              {data.session || "—"}
            </dd>
            <dt className="text-gray-500 dark:text-gray-400">Amount</dt>
            <dd className="col-span-2 text-gray-800 dark:text-gray-200">{data.amount || "—"}</dd>
          </dl>
        </div>

        <div className="mt-6 flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setBusy(true);
              goBack();
            }}
            className="flex-1 rounded-md bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 px-4 py-2 text-sm font-medium disabled:opacity-60"
          >
            Simulate completed deposit
          </button>
          <button
            type="button"
            onClick={() => (window.location.href = "/dashboard/checkout")}
            className="flex-1 rounded-md border border-gray-300 dark:border-gray-700 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200"
          >
            Cancel
          </button>
        </div>
      </div>
    </main>
  );
}

