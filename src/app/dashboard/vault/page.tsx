"use client";

import { useState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";

export default function VaultPage() {
  const t = useTranslations("vaultPage");
  const [feeNoteOpen, setFeeNoteOpen] = useState(false);
  const feeNoteWrapRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<{
    balanceInVault: string;
    apy: string;
    accruedYield: string;
    rateSource: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/vault")
      .then((r) => (r.ok ? r.json() : null))
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!feeNoteOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (
        feeNoteWrapRef.current &&
        !feeNoteWrapRef.current.contains(e.target as Node)
      ) {
        setFeeNoteOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [feeNoteOpen]);

  return (
    <div>
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <p className="mt-1 text-gray-600 dark:text-gray-400">
        {t("subtitle")}
      </p>

      {loading ? (
        <div className="mt-6 rounded-lg border border-gray-200 dark:border-gray-700 p-6 animate-pulse h-32" />
      ) : data ? (
        <div className="relative mt-6 max-w-xl space-y-4 rounded-lg border border-gray-200 bg-white p-6 pr-14 dark:border-gray-700 dark:bg-gray-800/50">
          <div
            ref={feeNoteWrapRef}
            className="absolute top-4 right-4 z-10"
          >
            <button
              type="button"
              onClick={() => setFeeNoteOpen((o) => !o)}
              aria-expanded={feeNoteOpen}
              aria-controls="vault-fee-note"
              aria-label={t("feeNoteTooltipAria")}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-gray-300 bg-white text-xs font-semibold text-gray-600 shadow-sm hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              ?
            </button>
            {feeNoteOpen && (
              <div
                id="vault-fee-note"
                role="region"
                className="absolute right-0 top-full z-20 mt-2 w-[min(calc(100vw-3rem),18rem)] rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-medium text-amber-800 shadow-lg dark:border-amber-800 dark:bg-amber-900/40 dark:text-amber-200"
              >
                {t("feeNote")}
              </div>
            )}
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase">
              {t("balanceInVault")}
            </h2>
            <p className="text-xl font-bold mt-1">{data.balanceInVault} USDC</p>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase">
              {t("currentApy")}
            </h2>
            <p className="text-xl font-bold mt-1">{data.apy || "—"}%</p>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase">
              {t("accruedYield")}
            </h2>
            <p className="text-xl font-bold mt-1">{data.accruedYield} USDC</p>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-500">
            {data.rateSource}
          </p>
        </div>
      ) : null}
    </div>
  );
}
