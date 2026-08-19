"use client";

import { useEffect, useState } from "react";

/** Starts a redeem intent then hops to app.sozu.capital for passkey/PIN. No WebAuthn here. */
export function PizzaAutoRedeem({ slug, guestAddress }: { slug: string; guestAddress: string }) {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/pizza/redeems", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug, guestAddress }),
        });
        const data = (await res.json()) as { error?: string; signUrl?: string };
        if (!res.ok) {
          if (!cancelled) setError(data.error ?? "Could not start pizza redeem");
          return;
        }
        if (data.signUrl && !cancelled) {
          window.location.assign(data.signUrl);
        }
      } catch {
        if (!cancelled) setError("Could not start pizza redeem");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug, guestAddress]);

  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-gray-50 dark:bg-gray-900">
      <div className="w-full max-w-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 text-center">
        <p className="text-lg font-semibold text-gray-900 dark:text-white">
          {error ? "Could not start redeem" : "Opening wallet to sign"}
        </p>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          {error ?? "Passkey or PIN runs on app.sozu.capital — not on this page."}
        </p>
      </div>
    </main>
  );
}
