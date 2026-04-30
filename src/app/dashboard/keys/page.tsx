"use client";

import { useState, useEffect } from "react";
import { usePrivy, useLinkAccount } from "@privy-io/react-auth";
import { useTranslations } from "next-intl";

export default function KeysPage() {
  const t = useTranslations("keysPage");
  const tc = useTranslations("common");
  const [wallet, setWallet] = useState<{ publicKey: string; network: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [recoverySent, setRecoverySent] = useState(false);
  const [passkeyError, setPasskeyError] = useState<string | null>(null);

  const { user, ready } = usePrivy();
  const { linkPasskey } = useLinkAccount({
    onSuccess: () => setPasskeyError(null),
    onError: (err) =>
      setPasskeyError(
        err != null && typeof err === "object" && "message" in err && typeof (err as { message: string }).message === "string"
          ? (err as { message: string }).message
          : t("passkeyFail")
      ),
  });

  const usePrivyAuth = !!process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  const hasPasskeyLinkedAccount =
    ready &&
    user &&
    Array.isArray((user as { linkedAccounts?: { type: string }[] }).linkedAccounts) &&
    (user as { linkedAccounts: { type: string }[] }).linkedAccounts.some((a) => a.type === "passkey");

  useEffect(() => {
    fetch("/api/wallet")
      .then((r) => (r.ok ? r.json() : null))
      .then(setWallet)
      .finally(() => setLoading(false));
  }, []);

  function handleSendRecovery() {
    fetch("/api/auth/recovery/send", { method: "POST" })
      .then((r) => r.json())
      .then(() => setRecoverySent(true))
      .catch(() => {});
  }

  function handleCreateOrManagePasskey() {
    setPasskeyError(null);
    linkPasskey?.();
  }

  return (
    <div>
      <h1 className="text-2xl font-bold">{t("title")}</h1>

      <div className="mt-6 max-w-xl rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 p-6">
        <p className="text-gray-700 dark:text-gray-300">
          {t("custodyIntro")}
        </p>
      </div>

      {usePrivyAuth && ready && (
        <section className="mt-8">
          <h2 className="text-lg font-semibold">{t("passkeyTitle")}</h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            {t("passkeyBody")}
          </p>
          {hasPasskeyLinkedAccount ? (
            <p className="mt-2 text-sm text-green-600 dark:text-green-400">
              {t("passkeyOk")}
            </p>
          ) : null}
          {passkeyError && (
            <p className="mt-2 text-sm text-red-600 dark:text-red-400">{passkeyError}</p>
          )}
          <button
            type="button"
            onClick={handleCreateOrManagePasskey}
            className="mt-3 rounded-md bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 px-3 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {hasPasskeyLinkedAccount ? t("addPasskey") : t("createPasskey")}
          </button>
        </section>
      )}

      {loading ? (
        <p className="mt-6 text-sm text-gray-500">{tc("loading")}</p>
      ) : wallet ? (
        <div className="mt-6 space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              {t("stellarPublicTitle")}
            </h2>
            <p className="mt-1 font-mono text-sm break-all text-gray-600 dark:text-gray-400">
              {wallet.publicKey}
            </p>
            <p className="mt-1 text-xs text-gray-500">{t("network", { network: wallet.network })}</p>
          </div>
        </div>
      ) : null}

      <section className="mt-8">
        <h2 className="text-lg font-semibold">{t("recoveryTitle")}</h2>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          {t("recoveryBody")}
        </p>
        <button
          type="button"
          onClick={handleSendRecovery}
          className="mt-3 rounded-md border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-sm font-medium"
        >
          {recoverySent ? t("recoverySent") : t("recoveryBtn")}
        </button>
        <p className="mt-4 text-sm text-gray-500 dark:text-gray-500">
          {t("recoveryAdvanced")}
        </p>
      </section>
    </div>
  );
}
