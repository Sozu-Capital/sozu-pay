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

export type StellarPayoutBody = {
  amount: string;
  toStellar: true;
  destination: string;
  recipientLabel?: string;
};

export type PayoutSuccess = {
  amount: string;
  destination: string;
  recipientLabel?: string;
  stellarTxHash?: string;
};

function formatTagLabel(tag: string): string {
  return `$${tag.replace(/^\$+/, "")}`;
}

export default function SendUsdcForm({
  onSent,
  onFailed,
  onRequireUnlock,
  onSubmitting,
}: {
  onSent?: (payout: PayoutSuccess) => void;
  onFailed?: (error: string) => void;
  onRequireUnlock?: (body: StellarPayoutBody) => void;
  /** When provided, form opens confirm flow (parent shows modal and submits on confirm). Receives summary and body so parent can submit later. */
  onSubmitting?: (
    summary: { amount: string; destination: string; recipientLabel?: string },
    body: StellarPayoutBody
  ) => void;
}) {
  const t = useTranslations("sendUsdcForm");
  const [recipientInput, setRecipientInput] = useState("");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [resolvedAddress, setResolvedAddress] = useState<string | null>(null);
  const [resolvedTag, setResolvedTag] = useState<string | null>(null);

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
      };
    }

    if (resolvedAddress) {
      return {
        amount,
        toStellar: true,
        destination: resolvedAddress,
        recipientLabel: resolvedTag ? formatTagLabel(resolvedTag) : undefined,
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
    (!!directAddress || !!resolvedAddress) &&
    !resolving &&
    !resolveError;

  return (
    <form onSubmit={handleSubmit} className="mt-3 flex flex-wrap gap-2 items-end max-w-md">
      <div className="min-w-[16rem] flex-1">
        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">
          {t("recipientLabel")}
        </label>
        <input
          value={recipientInput}
          onChange={(e) => setRecipientInput(e.target.value)}
          placeholder={t("recipientPlaceholder")}
          className="mt-1 w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1.5 text-sm"
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
        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">
          {t("amountLabel")}
        </label>
        <input
          type="text"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0"
          className="mt-1 w-24 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1.5 text-sm"
        />
      </div>
      <button
        type="submit"
        disabled={loading || !canSubmit}
        className="rounded-md border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-sm disabled:opacity-50"
      >
        {loading ? t("sending") : t("send")}
      </button>
    </form>
  );
}
