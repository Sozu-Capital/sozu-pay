"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  isValidStellarReceiveAddress,
  normalizeStellarAddressInput,
} from "@/lib/payment/stellar-address";
import {
  executeAndCompletePollarClientPayout,
  isPollarClientTxChallenge,
} from "@/lib/pollar/complete-client-payout";
import { cn } from "@/lib/utils";
import type { PayoutAsset } from "@/lib/payouts/asset";

export type StellarPayoutBody = {
  amount: string;
  toStellar: true;
  destination: string;
  recipientLabel?: string;
  asset?: PayoutAsset;
};

export type PayoutSuccess = {
  amount: string;
  destination: string;
  recipientLabel?: string;
  stellarTxHash?: string;
  asset?: PayoutAsset;
};

function formatTagLabel(tag: string): string {
  return `$${tag.replace(/^\$+/, "")}`;
}

export default function SendUsdcForm({
  onSent,
  onFailed,
  onRequireUnlock,
  onSubmitting,
  canSendPizza = false,
}: {
  onSent?: (payout: PayoutSuccess) => void;
  onFailed?: (error: string) => void;
  onRequireUnlock?: (body: StellarPayoutBody) => void;
  /** When provided, form opens confirm flow (parent shows modal and submits on confirm). Receives summary and body so parent can submit later. */
  onSubmitting?: (
    summary: { amount: string; destination: string; recipientLabel?: string; asset: PayoutAsset },
    body: StellarPayoutBody
  ) => void;
  canSendPizza?: boolean;
}) {
  const t = useTranslations("sendUsdcForm");
  const [recipientInput, setRecipientInput] = useState("");
  const [amount, setAmount] = useState("");
  const [asset, setAsset] = useState<PayoutAsset>("USDC");
  const [loading, setLoading] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [resolvedAddress, setResolvedAddress] = useState<string | null>(null);
  const [resolvedTag, setResolvedTag] = useState<string | null>(null);

  function selectAsset(next: PayoutAsset) {
    setAsset(next);
    if (next === "PIZZA" && amount && !/^[1-9][0-9]*$/.test(amount.trim())) {
      setAmount("");
    }
  }

  const directAddress = useMemo(() => {
    const n = normalizeStellarAddressInput(recipientInput);
    return isValidStellarReceiveAddress(n) ? n : null;
  }, [recipientInput]);

  useEffect(() => {
    if (directAddress) {
      setResolvedAddress(directAddress);
      setResolvedTag(null);
      setResolveError(null);
      return;
    }

    const trimmed = recipientInput.trim().replace(/^\$+/, "");
    if (trimmed.length < 3) {
      setResolvedAddress(null);
      setResolvedTag(null);
      setResolveError(null);
      return;
    }

    let cancelled = false;
    setResolving(true);
    const timer = setTimeout(() => {
      fetch("/api/wallet/resolve-recipient", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ recipient: recipientInput }),
      })
        .then(async (r) => {
          const data = await r.json().catch(() => ({}));
          if (cancelled) return;
          if (!r.ok) {
            setResolvedAddress(null);
            setResolvedTag(null);
            setResolveError(typeof data.error === "string" ? data.error : t("resolveFailed"));
            return;
          }
          setResolvedAddress(
            typeof data.walletAddress === "string" ? data.walletAddress : null
          );
          setResolvedTag(typeof data.tag === "string" ? data.tag : null);
          setResolveError(null);
        })
        .catch(() => {
          if (cancelled) return;
          setResolvedAddress(null);
          setResolvedTag(null);
          setResolveError(t("resolveFailed"));
        })
        .finally(() => {
          if (!cancelled) setResolving(false);
        });
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [recipientInput, directAddress, t]);

  async function resolveDestination(): Promise<StellarPayoutBody | null> {
    const trimmed = recipientInput.trim();
    if (!trimmed || !amount.trim()) return null;

    if (directAddress) {
      return {
        amount,
        toStellar: true,
        destination: directAddress,
        asset,
      };
    }

    if (resolvedAddress) {
      return {
        amount,
        toStellar: true,
        destination: resolvedAddress,
        recipientLabel: resolvedTag ? formatTagLabel(resolvedTag) : undefined,
        asset,
      };
    }

    setLoading(true);
    try {
      const res = await fetch("/api/wallet/resolve-recipient", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ recipient: trimmed }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || typeof data.walletAddress !== "string") {
        onFailed?.(typeof data.error === "string" ? data.error : t("resolveFailed"));
        return null;
      }
      return {
        amount,
        toStellar: true,
        destination: data.walletAddress,
        recipientLabel:
          typeof data.tag === "string" ? formatTagLabel(data.tag) : undefined,
        asset,
      };
    } catch {
      onFailed?.(t("resolveFailed"));
      return null;
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const body = await resolveDestination();
    if (!body) return;

    const summary = {
      amount,
      destination: body.destination,
      recipientLabel: body.recipientLabel ?? (resolvedTag ? formatTagLabel(resolvedTag) : undefined),
      asset,
    };

    if (onSubmitting) {
      onSubmitting(summary, body);
      return;
    }

    setLoading(true);
    fetch("/api/payouts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
      .then(async (r) => {
        const text = await r.text();
        let d: {
          payout?: {
            amount?: string;
            stellarTxHash?: string;
            stellarAddress?: string;
            recipientLabel?: string;
          };
          error?: string;
          requireUnlock?: boolean;
        } = {};
        try {
          d = text ? JSON.parse(text) : {};
        } catch {
          d = { error: r.ok ? "Invalid response" : `${r.status} ${r.statusText}` };
        }
        if (!r.ok && !d.error) {
          d.error =
            r.status === 502
              ? "Payout failed. Check terminal for details."
              : `Request failed (${r.status}).`;
        }
        return { ok: r.ok, data: d };
      })
      .then(async ({ ok, data: d }) => {
        if (d.requireUnlock && d.error && onRequireUnlock) {
          onRequireUnlock(body);
          return;
        }
        if (isPollarClientTxChallenge(d)) {
          try {
            const result = await executeAndCompletePollarClientPayout(d);
            setRecipientInput("");
            setAmount("");
            setResolvedAddress(null);
            setResolvedTag(null);
            onSent?.({
              amount: typeof result.payout.amount === "string" ? result.payout.amount : amount,
              destination: result.payout.stellarAddress ?? body.destination,
              recipientLabel: result.payout.recipientLabel ?? body.recipientLabel,
              stellarTxHash: result.stellarTxHash,
              asset,
            });
          } catch (err) {
            const msg = err instanceof Error ? err.message : "Pollar payout failed.";
            if (onFailed) onFailed(msg);
            else alert(msg);
          }
          return;
        }
        if (ok && d.payout) {
          const p = d.payout;
          setRecipientInput("");
          setAmount("");
          setResolvedAddress(null);
          setResolvedTag(null);
          onSent?.({
            amount: typeof p.amount === "string" ? p.amount : amount,
            destination: p.stellarAddress ?? body.destination,
            recipientLabel: p.recipientLabel ?? body.recipientLabel,
            stellarTxHash: p.stellarTxHash,
            asset,
          });
        } else if (d.error) {
          if (onFailed) onFailed(d.error);
          else alert(d.error);
        }
      })
      .catch((err) => {
        const msg = err instanceof Error ? err.message : "Payout request failed.";
        if (onFailed) onFailed(msg);
        else alert(msg);
      })
      .finally(() => setLoading(false));
  }

  const canSubmit =
    !!amount.trim() &&
    (asset !== "PIZZA" || /^[1-9][0-9]*$/.test(amount.trim())) &&
    (!!directAddress || !!resolvedAddress) &&
    !resolving &&
    !resolveError;

  const fieldClass =
    "mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-violet-500";

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-4">
      <div>
        <p className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t("assetLabel")}</p>
        <div
          role="radiogroup"
          aria-label={t("assetLabel")}
          className="mt-2 inline-flex rounded-full border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-800 p-0.5"
        >
          {(["USDC", "PIZZA"] as const).map((option) => {
            const selected = asset === option;
            const pizzaLocked = option === "PIZZA" && !canSendPizza;
            return (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={pizzaLocked}
                title={pizzaLocked ? t("pizzaUnavailable") : undefined}
                onClick={() => selectAsset(option)}
                className={cn(
                  "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                  selected
                    ? "bg-gray-900 text-white shadow-sm dark:bg-white dark:text-gray-900"
                    : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white",
                  pizzaLocked && "cursor-not-allowed opacity-40 hover:text-gray-600 dark:hover:text-gray-400"
                )}
              >
                {option === "USDC" ? t("assetUsdc") : t("assetPizza")}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label htmlFor="send-recipient" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          {t("recipientLabel")}
        </label>
        <input
          id="send-recipient"
          value={recipientInput}
          onChange={(e) => setRecipientInput(e.target.value)}
          placeholder={t("recipientPlaceholder")}
          autoComplete="off"
          className={fieldClass}
        />
        {resolving ? (
          <p className="mt-1 text-xs text-gray-500">{t("resolving")}</p>
        ) : resolveError ? (
          <p className="mt-1 text-xs text-red-600 dark:text-red-400">{resolveError}</p>
        ) : resolvedTag && resolvedAddress ? (
          <p className="mt-1 text-xs text-green-700 dark:text-green-400">
            {t("resolvedTo", { tag: formatTagLabel(resolvedTag), address: resolvedAddress.slice(0, 8) })}
          </p>
        ) : directAddress ? (
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{t("directAddress")}</p>
        ) : null}
      </div>

      <div>
        <label htmlFor="send-amount" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          {asset === "PIZZA" ? t("amountLabelPizza") : t("amountLabel")}
        </label>
        <input
          id="send-amount"
          type="text"
          inputMode={asset === "PIZZA" ? "numeric" : "decimal"}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder={asset === "PIZZA" ? "1" : "0.00"}
          className={fieldClass}
        />
      </div>

      <button
        type="submit"
        disabled={loading || !canSubmit}
        className="w-full rounded-lg bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 py-2.5 px-4 font-medium hover:opacity-90 disabled:opacity-50"
      >
        {loading ? t("sending") : asset === "PIZZA" ? t("sendPizza") : t("send")}
      </button>
    </form>
  );
}
