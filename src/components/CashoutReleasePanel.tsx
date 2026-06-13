"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useSmartAccountKitContext } from "@/components/SmartAccountKitProvider";
import { signSorobanEnvelopeWithPasskey } from "@/lib/stellar/smartAccounts/signSorobanPayout";
import { connectSessionPasskeyWallet } from "@/lib/stellar/smartAccounts/sessionWallet";

type Props = {
  withdrawalId: string;
  amountUsd: string;
  fiatSentAt: string | null;
  onReleased: () => void;
};

export function CashoutReleasePanel({ withdrawalId, amountUsd, fiatSentAt, onReleased }: Props) {
  const t = useTranslations("cashOutPage");
  const { kit, credentialId, ready: kitReady } = useSmartAccountKitContext();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const releaseUsdc = async () => {
    if (!kitReady || !kit) {
      setError(t("releaseKitNotReady"));
      return;
    }

    if (
      !confirm(
        t("releaseConfirm", { amount: amountUsd }),
      )
    ) {
      return;
    }

    setBusy(true);
    setError(null);
    setSuccess(null);

    try {
      const configRes = await fetch("/api/smart-accounts/config", { credentials: "include" });
      const config = (await configRes.json().catch(() => ({}))) as {
        networkPassphrase?: string;
        error?: string;
      };
      if (!configRes.ok || !config.networkPassphrase) {
        throw new Error(config.error ?? t("releaseConfigError"));
      }

      const prepareRes = await fetch(`/api/cashout/${withdrawalId}/release/prepare`, {
        method: "POST",
        credentials: "include",
      });
      const prepared = (await prepareRes.json().catch(() => ({}))) as {
        envelopeXdr?: string;
        disbursementContractId?: string;
        error?: string;
        code?: string;
      };
      if (!prepareRes.ok) {
        throw new Error(prepared.error ?? t("releasePrepareFailed"));
      }
      if (!prepared.envelopeXdr) {
        throw new Error(t("releasePrepareFailed"));
      }

      const connected = await connectSessionPasskeyWallet(kit, {
        prompt: true,
        credentialId,
      });
      if (!connected?.contractId || !connected.credentialId) {
        throw new Error(t("releasePasskeyCancelled"));
      }

      const signedEnvelopeXdr = await signSorobanEnvelopeWithPasskey({
        kit,
        envelopeXdr: prepared.envelopeXdr,
        networkPassphrase: config.networkPassphrase,
        credentialId: connected.credentialId,
        primaryContractId: prepared.disbursementContractId ?? connected.contractId,
      });

      const submitRes = await fetch(`/api/cashout/${withdrawalId}/release/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          signedEnvelopeXdr,
          credentialId: connected.credentialId,
          contractId: connected.contractId,
        }),
      });
      const submitted = (await submitRes.json().catch(() => ({}))) as {
        stellarTxHash?: string;
        error?: string;
      };
      if (!submitRes.ok) {
        throw new Error(submitted.error ?? t("releaseSubmitFailed"));
      }

      setSuccess(t("releaseSuccess", { hash: submitted.stellarTxHash?.slice(0, 12) ?? "—" }));
      onReleased();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("releaseSubmitFailed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-6 rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 p-5">
      <p className="font-semibold text-emerald-900 dark:text-emerald-100">{t("releaseTitle")}</p>
      <p className="mt-1 text-sm text-emerald-800 dark:text-emerald-200">{t("releaseBody")}</p>
      {fiatSentAt && (
        <p className="mt-2 text-xs text-emerald-700 dark:text-emerald-300">
          {t("releaseFiatSentAt", { date: new Date(fiatSentAt).toLocaleString() })}
        </p>
      )}
      {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
      {success && <p className="mt-3 text-sm text-emerald-600 dark:text-emerald-400">{success}</p>}
      <button
        type="button"
        disabled={busy || !kitReady}
        onClick={releaseUsdc}
        className="mt-4 w-full rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold py-2.5 text-sm"
      >
        {busy ? t("releaseSubmitting") : t("releaseButton")}
      </button>
      {!kitReady && (
        <p className="mt-2 text-xs text-emerald-700 dark:text-emerald-400">{t("releaseKitNotReady")}</p>
      )}
    </div>
  );
}
