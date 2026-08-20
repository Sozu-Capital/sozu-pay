"use client";

import { useEffect, useState } from "react";

import { pizzaPayerThanks, pizzaPayerWalletHomeUrl } from "@/lib/pizza/deposits";

export function PizzaClaimedConfirmation({
  pointName,
  walletOrigin,
}: {
  pointName: string;
  walletOrigin: string;
}) {
  const thanks = pizzaPayerThanks(pointName);
  const walletHome = pizzaPayerWalletHomeUrl(walletOrigin);

  useEffect(() => {
    const id = window.setTimeout(() => {
      window.location.assign(walletHome);
    }, 5000);
    return () => window.clearTimeout(id);
  }, [walletHome]);

  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-gray-50 dark:bg-gray-900">
      <div className="w-full max-w-sm rounded-xl border border-emerald-200 dark:border-emerald-800 bg-white dark:bg-gray-800 p-6 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/40">
          <svg className="h-6 w-6 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <p className="text-lg font-semibold text-gray-900 dark:text-white">{thanks.title}</p>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{thanks.body}</p>
        <a
          href={walletHome}
          className="mt-6 inline-flex w-full items-center justify-center rounded-lg bg-gray-900 dark:bg-gray-100 px-4 py-3 text-sm font-medium text-white dark:text-gray-900"
        >
          Continue in Sozu
        </a>
        <p className="mt-3 text-xs text-gray-400">Taking you to app.sozu.capital…</p>
      </div>
    </main>
  );
}

export function PizzaRedeemPoller({
  intentId,
  pointName,
  walletOrigin,
}: {
  intentId: string;
  pointName: string;
  walletOrigin: string;
}) {
  const [claimed, setClaimed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      const res = await fetch(`/api/pizza/redeems/${encodeURIComponent(intentId)}`);
      if (!res.ok) return;
      const data = (await res.json()) as { redeem?: { status?: string } };
      if (!cancelled && data.redeem?.status === "submitted") {
        setClaimed(true);
      }
    };
    void tick();
    const id = setInterval(() => void tick(), 1500);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [intentId]);

  if (claimed) {
    return <PizzaClaimedConfirmation pointName={pointName} walletOrigin={walletOrigin} />;
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-gray-50 dark:bg-gray-900">
      <div className="w-full max-w-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 text-center">
        <p className="text-lg font-semibold text-gray-900 dark:text-white">Waiting for signature</p>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          Finish passkey or PIN on app.sozu.capital. This page will show claimed when 1 PIZZA lands in the store treasury.
        </p>
      </div>
    </main>
  );
}
