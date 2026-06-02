"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useSmartAccountKitContext } from "@/components/SmartAccountKitProvider";
import { detectPasskeySupport } from "@/lib/passkey/support";
import { logPasskeyEvent } from "@/lib/passkey/log";

type PrepareResponse = {
  sessionId: string;
  authorizeUrl: string;
  expiresAt: string;
  disbursement: {
    name: string;
    totalPayments: number;
    totalAmount: string;
    assetCode: string;
  };
  smartAccount: { contractId: string };
};

export type DisbursementAuthorizeResult = {
  sessionId: string;
  credentialId?: string;
  contractId?: string;
};

type Props = {
  open: boolean;
  disbursementId: string;
  onClose: () => void;
  onAuthorized: (result: DisbursementAuthorizeResult) => Promise<void>;
};

type Phase = "loading" | "local" | "qr" | "polling" | "error";

export function DisbursementAuthorizeModal({
  open,
  disbursementId,
  onClose,
  onAuthorized,
}: Props) {
  const t = useTranslations("disbursementsPage");
  const { ready, kit, connect } = useSmartAccountKitContext();

  const [phase, setPhase] = useState<Phase>("loading");
  const [prepare, setPrepare] = useState<PrepareResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [passkeyReason, setPasskeyReason] = useState<string | null>(null);
  const [approving, setApproving] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const startPolling = useCallback(
    (sessionId: string) => {
      stopPolling();
      setPhase("polling");
      pollRef.current = setInterval(async () => {
        try {
          const res = await fetch(`/api/signing-sessions/${sessionId}`, { credentials: "include" });
          const data = await res.json().catch(() => ({}));
          if (data.status === "verified") {
            stopPolling();
            setApproving(true);
            try {
              await onAuthorized({ sessionId });
            } finally {
              setApproving(false);
            }
          } else if (data.status === "expired") {
            stopPolling();
            setError(t("authorizeSessionExpired"));
            setPhase("error");
          }
        } catch {
          // keep polling
        }
      }, 2000);
    },
    [onAuthorized, stopPolling, t]
  );

  useEffect(() => {
    if (phase === "qr" && prepare && !pollRef.current) {
      startPolling(prepare.sessionId);
    }
  }, [phase, prepare, startPolling]);

  useEffect(() => {
    if (!open) {
      stopPolling();
      setPhase("loading");
      setPrepare(null);
      setError(null);
      setPasskeyReason(null);
      return;
    }

    let cancelled = false;

    (async () => {
      setPhase("loading");
      setError(null);

      try {
        const prepRes = await fetch(
          `/api/sdp/disbursements/${disbursementId}/authorize/prepare`,
          { method: "POST", credentials: "include" }
        );
        const prepData = (await prepRes.json().catch(() => ({}))) as PrepareResponse & {
          error?: string;
          code?: string;
          setupUrl?: string;
        };

        if (!prepRes.ok) {
          if (prepData.code === "SMART_WALLET_REQUIRED" && prepData.setupUrl) {
            setError(t("authorizeSmartWalletRequired"));
          } else if (prepData.error) {
            setError(prepData.error);
          } else {
            setError(t("authorizePrepareFailed"));
          }
          setPhase("error");
          return;
        }

        if (cancelled) return;
        setPrepare(prepData);

        const support = await detectPasskeySupport();
        if (cancelled) return;

        if (support.localSupported) {
          setPhase("local");
        } else {
          logPasskeyEvent("warn", {
            action: "authorize_modal_qr_fallback",
            disbursementId,
            sessionId: prepData.sessionId,
            reason: support.code,
            userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
            details: { message: support.reason },
          });
          setPasskeyReason(support.reason ?? t("authorizePasskeyUnsupported"));
          setPhase("qr");
        }
      } catch (e) {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : t("authorizePrepareFailed");
        logPasskeyEvent("error", {
          action: "authorize_prepare_client",
          disbursementId,
          reason: "prepare_failed",
          details: { message: msg },
        });
        setError(msg);
        setPhase("error");
      }
    })();

    return () => {
      cancelled = true;
      stopPolling();
    };
  }, [open, disbursementId, stopPolling, t]);

  const handleLocalApprove = async () => {
    if (!prepare) return;
    setApproving(true);
    setError(null);

    try {
      if (!ready || !kit) {
        throw new Error(t("authorizeKitNotReady"));
      }

      const connected = await connect({ prompt: true });

      const activeContractId = connected.contractId ?? prepare.smartAccount.contractId;
      const activeCredentialId = connected.credentialId;
      if (!activeContractId || !activeCredentialId) {
        throw new Error(t("authorizePasskeyFailed"));
      }

      await onAuthorized({
        sessionId: prepare.sessionId,
        credentialId: activeCredentialId,
        contractId: activeContractId,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : t("authorizePasskeyFailed");
      logPasskeyEvent("error", {
        action: "authorize_local_passkey",
        disbursementId,
        sessionId: prepare.sessionId,
        reason: "passkey_prompt_failed",
        userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
        details: { message: msg },
      });
      setError(msg);
      setPhase("qr");
      setPasskeyReason(t("authorizePasskeyFallbackHint"));
    } finally {
      setApproving(false);
    }
  };

  const handleUseQr = () => {
    if (!prepare) return;
    setPhase("qr");
    startPolling(prepare.sessionId);
  };

  if (!open) return null;

  const qrImageUrl = prepare
    ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(prepare.authorizeUrl)}`
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="authorize-title"
        className="w-full max-w-md rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-6 shadow-xl"
      >
        <h2 id="authorize-title" className="text-lg font-semibold text-gray-900 dark:text-white">
          {t("authorizeTitle")}
        </h2>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{t("authorizeBody")}</p>

        {prepare && (
          <div className="mt-4 rounded-lg bg-gray-50 dark:bg-gray-800/60 p-3 text-sm space-y-1">
            <p className="font-medium text-gray-900 dark:text-white">{prepare.disbursement.name}</p>
            <p className="text-gray-600 dark:text-gray-400">
              {prepare.disbursement.totalPayments} {t("payments")} ·{" "}
              {prepare.disbursement.totalAmount} {prepare.disbursement.assetCode}
            </p>
          </div>
        )}

        {phase === "loading" && (
          <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">{t("authorizeLoading")}</p>
        )}

        {phase === "local" && prepare && (
          <div className="mt-6 space-y-3">
            <button
              type="button"
              disabled={approving || !ready}
              onClick={() => void handleLocalApprove()}
              className="w-full rounded-md bg-green-600 text-white py-2.5 px-4 text-sm font-medium hover:bg-green-700 disabled:opacity-60"
            >
              {approving ? t("authorizeApproving") : t("authorizeWithPasskey")}
            </button>
            <button
              type="button"
              disabled={approving}
              onClick={handleUseQr}
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 py-2.5 px-4 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              {t("authorizeUsePhone")}
            </button>
          </div>
        )}

        {(phase === "qr" || phase === "polling") && prepare && (
          <div className="mt-6 space-y-4 text-center">
            {passkeyReason && (
              <p className="text-sm text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 rounded-md px-3 py-2">
                {passkeyReason}
              </p>
            )}
            {qrImageUrl && (
              <a
                href={prepare.authorizeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block"
              >
                <img
                  src={qrImageUrl}
                  alt={t("authorizeQrAlt")}
                  width={200}
                  height={200}
                  className="mx-auto rounded-md border border-gray-200 dark:border-gray-700"
                />
              </a>
            )}
            <p className="text-sm text-gray-600 dark:text-gray-400">{t("authorizeQrHint")}</p>
            <code className="block text-xs break-all text-gray-500 dark:text-gray-500">
              {prepare.authorizeUrl}
            </code>
            {phase === "polling" && (
              <p className="text-sm text-blue-600 dark:text-blue-400">{t("authorizeWaitingPhone")}</p>
            )}
            {!pollRef.current && (
              <button
                type="button"
                onClick={() => startPolling(prepare.sessionId)}
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
              >
                {t("authorizeStartPolling")}
              </button>
            )}
          </div>
        )}

        {error && (
          <p className="mt-4 text-sm text-red-600 dark:text-red-400" role="alert">
            {error}
          </p>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            disabled={approving}
            onClick={onClose}
            className="rounded-md border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-60"
          >
            {t("cancel")}
          </button>
        </div>
      </div>
    </div>
  );
}
