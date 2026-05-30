"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";

const FRIENDBOT_URL = "https://friendbot.stellar.org";

export default function SetPayoutWalletPage() {
  const router = useRouter();
  const t = useTranslations("onboardingPages.payoutWallet");
  const tCommon = useTranslations("onboardingPages");
  const [passphrase, setPassphrase] = useState("");
  const [confirmPassphrase, setConfirmPassphrase] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successPublicKey, setSuccessPublicKey] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (passphrase.length < 8) {
      setError(t("passphraseMin"));
      return;
    }
    if (passphrase !== confirmPassphrase) {
      setError(t("passphraseMismatch"));
      return;
    }
    setSubmitting(true);
    fetch("/api/profile/wallet/set-passphrase", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        passphrase,
        confirmPassphrase,
      }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.error) {
          setError(d.error);
          setSubmitting(false);
          return;
        }
        setSubmitting(false);
        setSuccessPublicKey(d.publicKey ?? null);
      })
      .catch(() => {
        setError(tCommon("somethingWentWrong"));
        setSubmitting(false);
      });
  }

  if (successPublicKey) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-4 bg-gray-50 dark:bg-gray-900">
        <div className="w-full max-w-md rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 shadow-sm">
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{t("successTitle")}</h1>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{t("successBody")}</p>
          <div className="mt-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <code className="flex-1 min-w-0 font-mono text-sm break-all bg-gray-100 dark:bg-gray-700 px-2 py-1.5 rounded">
                {successPublicKey}
              </code>
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(successPublicKey)}
                className="rounded-md border border-gray-300 dark:border-gray-600 px-2 py-1.5 text-xs font-medium shrink-0"
              >
                {t("copy")}
              </button>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {t("testnetHintBefore")}
              <a
                href={`${FRIENDBOT_URL}/?addr=${encodeURIComponent(successPublicKey)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 dark:text-blue-400 hover:underline"
              >
                {t("friendbot")}
              </a>
              {t("testnetHintAfter")}
            </p>
          </div>
          <div className="mt-6 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => router.replace("/dashboard/profile")}
              className="w-full rounded-md bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 py-2.5 px-4 font-medium"
            >
              {t("continueProfile")}
            </button>
            <Link
              href="/dashboard"
              className="w-full text-center rounded-md border border-gray-300 dark:border-gray-600 py-2.5 px-4 text-sm font-medium"
            >
              {t("goDashboard")}
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4 bg-gray-50 dark:bg-gray-900">
      <div className="w-full max-w-md rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{t("title")}</h1>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{t("subtitle")}</p>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="passphrase" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              {t("passphraseLabel")}
            </label>
            <input
              id="passphrase"
              type="password"
              autoComplete="new-password"
              minLength={8}
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              placeholder={t("passphrasePlaceholder")}
              className="mt-1 w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-gray-900 dark:text-white"
            />
          </div>
          <div>
            <label
              htmlFor="confirmPassphrase"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              {t("confirmLabel")}
            </label>
            <input
              id="confirmPassphrase"
              type="password"
              autoComplete="new-password"
              minLength={8}
              value={confirmPassphrase}
              onChange={(e) => setConfirmPassphrase(e.target.value)}
              placeholder={t("confirmPlaceholder")}
              className="mt-1 w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-gray-900 dark:text-white"
            />
          </div>
          {error && (
            <p className="text-sm text-red-600 dark:text-red-400" role="alert">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-md bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 py-2.5 px-4 font-medium disabled:opacity-50"
          >
            {submitting ? t("submitting") : t("submit")}
          </button>
        </form>
        <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">{t("footer")}</p>
      </div>
    </main>
  );
}
