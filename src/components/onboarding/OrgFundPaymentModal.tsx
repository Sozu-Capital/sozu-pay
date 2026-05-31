"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

export type OrgFundPaymentMethod = "card" | "bank_transfer";

type OrgFundPaymentModalProps = {
  open: boolean;
  onClose: () => void;
  orgSozuTag?: string | null;
};

export function OrgFundPaymentModal({ open, onClose, orgSozuTag }: OrgFundPaymentModalProps) {
  const t = useTranslations("onboardingPages.createOrg");
  const [amountUsd, setAmountUsd] = useState("100");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  async function startDeposit(method: OrgFundPaymentMethod) {
    setError("");
    const amount = parseFloat(amountUsd);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError(t("fundInvalidAmount"));
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/checkout/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          amountUsd: amountUsd.trim(),
          paymentMethod: method,
          reference: orgSozuTag ? `fund-org-${orgSozuTag}` : "fund-org-treasury",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : t("fundCheckoutFailed"));
        return;
      }
      if (typeof data.checkoutUrl === "string") {
        window.location.href = data.checkoutUrl;
      }
    } catch {
      setError(t("fundCheckoutFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="fund-modal-title"
    >
      <div className="w-full max-w-md rounded-xl border border-white/15 bg-gray-950 p-6 shadow-2xl text-white">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="fund-modal-title" className="text-lg font-semibold">
              {t("fundModalTitle")}
            </h2>
            <p className="mt-1 text-sm text-gray-400">{t("fundModalBody")}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-md p-1 text-gray-400 hover:text-white disabled:opacity-50"
            aria-label={t("fundModalClose")}
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
              <path strokeWidth={2} strokeLinecap="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {orgSozuTag ? (
          <p className="mt-3 text-xs text-emerald-200/90">
            {t("fundModalTagHint", { tag: `$${orgSozuTag}` })}
          </p>
        ) : null}

        <label className="mt-4 block">
          <span className="text-xs font-medium text-gray-300">{t("fundAmountLabel")}</span>
          <div className="mt-1 flex items-center rounded-md border border-white/15 bg-black/40">
            <span className="pl-3 text-sm text-gray-500">$</span>
            <input
              type="text"
              inputMode="decimal"
              value={amountUsd}
              onChange={(e) => setAmountUsd(e.target.value.replace(/[^\d.]/g, ""))}
              className="w-full bg-transparent px-2 py-2.5 text-sm text-white focus:outline-none"
              disabled={busy}
            />
            <span className="pr-3 text-xs text-gray-500">USD</span>
          </div>
        </label>

        <p className="mt-4 text-xs font-medium uppercase tracking-wider text-gray-500">
          {t("fundMethodHeading")}
        </p>

        <div className="mt-3 space-y-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void startDeposit("card")}
            className={cn(
              "w-full flex items-center gap-3 rounded-lg border border-white/15 bg-white/5 px-4 py-3 text-left",
              "hover:bg-white/10 transition-colors disabled:opacity-50"
            )}
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
                <rect x="2" y="5" width="20" height="14" rx="2" strokeWidth={1.5} />
                <path strokeWidth={1.5} d="M2 10h20" />
              </svg>
            </span>
            <span>
              <span className="block text-sm font-medium">{t("fundMethodCard")}</span>
              <span className="block text-xs text-gray-400">{t("fundMethodCardSub")}</span>
            </span>
          </button>

          <button
            type="button"
            disabled={busy}
            onClick={() => void startDeposit("bank_transfer")}
            className={cn(
              "w-full flex items-center gap-3 rounded-lg border border-white/15 bg-white/5 px-4 py-3 text-left",
              "hover:bg-white/10 transition-colors disabled:opacity-50"
            )}
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
                <path strokeWidth={1.5} strokeLinecap="round" d="M3 10h18M6 14h4M6 18h2" />
                <path strokeWidth={1.5} strokeLinecap="round" d="M4 6h16v12H4z" />
              </svg>
            </span>
            <span>
              <span className="block text-sm font-medium">{t("fundMethodBank")}</span>
              <span className="block text-xs text-gray-400">{t("fundMethodBankSub")}</span>
            </span>
          </button>
        </div>

        {error ? <p className="mt-3 text-sm text-red-400">{error}</p> : null}
        {busy ? (
          <p className="mt-3 text-xs text-gray-400">{t("fundRedirecting")}</p>
        ) : null}
      </div>
    </div>
  );
}
