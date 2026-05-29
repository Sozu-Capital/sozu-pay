"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useSmartAccountKitContext } from "@/components/SmartAccountKitProvider";
import { logPasskeyEvent } from "@/lib/passkey/log";

type SessionInfo = {
  sessionId: string;
  status: string;
  expiresAt: string;
  disbursement: {
    id: string;
    name: string;
    totalPayments: number;
    totalAmount: string;
    assetCode: string;
  };
};

export default function CrossDeviceSignPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = typeof params.sessionId === "string" ? params.sessionId : "";
  const t = useTranslations("disbursementsPage");
  const { ready, connect } = useSmartAccountKitContext();

  const [session, setSession] = useState<SessionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const loadSession = useCallback(async () => {
    if (!sessionId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/signing-sessions/${sessionId}`, { credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        const returnTo = encodeURIComponent(`/sign/${sessionId}`);
        router.replace(`/login?returnTo=${returnTo}`);
        return;
      }
      if (!res.ok) {
        setError(data.error ?? t("authorizeSessionNotFound"));
        return;
      }
      setSession(data as SessionInfo);
      if (data.status === "verified" || data.status === "consumed") {
        setDone(true);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t("authorizePrepareFailed"));
    } finally {
      setLoading(false);
    }
  }, [sessionId, router, t]);

  useEffect(() => {
    void loadSession();
  }, [loadSession]);

  const handleApprove = async () => {
    if (!sessionId) return;
    setSubmitting(true);
    setError(null);

    try {
      if (!ready) throw new Error(t("authorizeKitNotReady"));
      const connected = await connect({ prompt: true });

      if (!connected.contractId || !connected.credentialId) {
        throw new Error(t("authorizePasskeyFailed"));
      }

      const res = await fetch(`/api/signing-sessions/${sessionId}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          credentialId: connected.credentialId,
          contractId: connected.contractId,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        logPasskeyEvent("error", {
          action: "cross_device_complete",
          sessionId,
          reason: data.code ?? "complete_failed",
          userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
          details: { message: data.error },
        });
        throw new Error(data.error ?? t("authorizePasskeyFailed"));
      }

      logPasskeyEvent("info", {
        action: "cross_device_complete_ok",
        sessionId,
        userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
      });
      setDone(true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : t("authorizePasskeyFailed");
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-gray-50 dark:bg-gray-950">
      <div className="w-full max-w-md rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-6 shadow-sm">
        <h1 className="text-lg font-semibold text-gray-900 dark:text-white">{t("authorizeMobileTitle")}</h1>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{t("authorizeMobileBody")}</p>

        {loading && (
          <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">{t("authorizeLoading")}</p>
        )}

        {session && !done && (
          <div className="mt-4 space-y-4">
            <div className="rounded-lg bg-gray-50 dark:bg-gray-800/60 p-3 text-sm">
              <p className="font-medium text-gray-900 dark:text-white">{session.disbursement.name}</p>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                {session.disbursement.totalPayments} {t("payments")} · {session.disbursement.totalAmount}{" "}
                {session.disbursement.assetCode}
              </p>
            </div>
            <button
              type="button"
              disabled={submitting || !ready || session.status === "expired"}
              onClick={() => void handleApprove()}
              className="w-full rounded-md bg-green-600 text-white py-2.5 px-4 text-sm font-medium hover:bg-green-700 disabled:opacity-60"
            >
              {submitting ? t("authorizeApproving") : t("authorizeWithPasskey")}
            </button>
          </div>
        )}

        {done && (
          <div className="mt-4 rounded-lg bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800 p-4 text-sm text-green-800 dark:text-green-300">
            {t("authorizeMobileDone")}
          </div>
        )}

        {error && (
          <p className="mt-4 text-sm text-red-600 dark:text-red-400" role="alert">
            {error}
          </p>
        )}

        <p className="mt-6 text-center">
          <Link href="/dashboard/disbursements" className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
            {t("authorizeBackToDashboard")}
          </Link>
        </p>
      </div>
    </main>
  );
}
