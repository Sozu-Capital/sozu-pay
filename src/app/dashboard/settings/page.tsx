"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import BankAccountsSection from "@/components/BankAccountsSection";
import { usePrivy } from "@privy-io/react-auth";
import { useTranslations } from "next-intl";

export default function SettingsPage() {
  const t = useTranslations("settingsPage");
  const tc = useTranslations("common");
  const [user, setUser] = useState<{ email: string; twoFactorEnabled?: boolean } | null>(null);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [totpCode, setTotpCode] = useState("");
  const [showTotpSetup, setShowTotpSetup] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [orgTag, setOrgTag] = useState<string | null>(null);
  const [orgTagInput, setOrgTagInput] = useState("");
  const [orgTagBusy, setOrgTagBusy] = useState(false);
  const [orgTagError, setOrgTagError] = useState<string | null>(null);
  const [orgTagSaved, setOrgTagSaved] = useState(false);
  const privy = usePrivy();
  const usePrivyAuth = typeof window !== "undefined" && !!process.env.NEXT_PUBLIC_PRIVY_APP_ID;

  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((data) => {
        setUser(data.user);
        setTwoFactorEnabled(data.user?.twoFactorEnabled ?? false);
      })
      .catch(() => setUser(null));
  }, []);

  useEffect(() => {
    fetch("/api/profile/org/sozu-tag", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { username?: string | null } | null) => {
        const username = typeof d?.username === "string" ? d.username : null;
        setOrgTag(username);
        setOrgTagInput(username ? `$${username}` : "");
      })
      .catch(() => {});
  }, []);

  function handleToggle2FA() {
    if (!twoFactorEnabled) {
      setShowTotpSetup(true);
      return;
    }
    setTwoFactorEnabled(false);
    setShowTotpSetup(false);
  }

  function handleConfirmTotp(e: React.FormEvent) {
    e.preventDefault();
    setTwoFactorEnabled(true);
    setShowTotpSetup(false);
    setTotpCode("");
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <Link
          href="/dashboard/profile"
          className="rounded-md border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          {t("profileLink")}
        </Link>
      </div>
      {user && (
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{user.email}</p>
      )}

      <section className="mt-8" id="security">
        <h2 className="text-lg font-semibold">{t("security")}</h2>
        <div className="mt-4 flex items-center gap-4">
          <span className="text-sm text-gray-700 dark:text-gray-300">
            {t("totpLabel", { state: twoFactorEnabled ? t("totpOn") : t("totpOff") })}
          </span>
          <button
            type="button"
            onClick={handleToggle2FA}
            className="rounded-md border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-sm font-medium"
          >
            {twoFactorEnabled ? t("disable") : t("enable")}
          </button>
        </div>
        {showTotpSetup && (
          <form onSubmit={handleConfirmTotp} className="mt-4 p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 max-w-xs">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              {t("totpHelp")}
            </p>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ""))}
              placeholder="000000"
              className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2"
              aria-label={t("totpAria")}
            />
            <div className="mt-2 flex gap-2">
              <button type="submit" className="rounded-md bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 px-3 py-1.5 text-sm">
                {tc("confirm")}
              </button>
              <button
                type="button"
                onClick={() => { setShowTotpSetup(false); setTotpCode(""); }}
                className="rounded-md border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-sm"
              >
                {tc("cancel")}
              </button>
            </div>
          </form>
        )}
      </section>

      <section className="mt-8" id="sozu-tag">
        <h2 className="text-lg font-semibold">{t("sozuTagTitle")}</h2>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{t("sozuTagBody")}</p>
        <form
          className="mt-4 max-w-md space-y-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setOrgTagBusy(true);
            setOrgTagError(null);
            setOrgTagSaved(false);
            try {
              const res = await fetch("/api/profile/org/sozu-tag", {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username: orgTagInput }),
              });
              const data = await res.json().catch(() => ({}));
              if (!res.ok) {
                setOrgTagError((data.error as string) ?? t("sozuTagSaveFailed"));
                return;
              }
              const username = typeof data.username === "string" ? data.username : null;
              setOrgTag(username);
              setOrgTagInput(username ? `$${username}` : orgTagInput);
              setOrgTagSaved(true);
              setTimeout(() => setOrgTagSaved(false), 2000);
            } finally {
              setOrgTagBusy(false);
            }
          }}
        >
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            {t("sozuTagLabel")}
          </label>
          <input
            value={orgTagInput}
            onChange={(e) => setOrgTagInput(e.target.value)}
            placeholder="$myorg"
            className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2"
            aria-label={t("sozuTagAria")}
          />
          {orgTag && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {t("sozuTagCurrent", { tag: `$${orgTag}` })}
            </p>
          )}
          {orgTagError && <p className="text-sm text-red-600 dark:text-red-400">{orgTagError}</p>}
          <button
            type="submit"
            disabled={orgTagBusy}
            className="rounded-md bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 px-3 py-1.5 text-sm disabled:opacity-60"
          >
            {orgTagBusy ? t("sozuTagSaving") : t("sozuTagSave")}
          </button>
          {orgTagSaved && <p className="text-xs text-emerald-600 dark:text-emerald-400">{t("sozuTagSaved")}</p>}
        </form>
      </section>

      <section className="mt-8" id="recovery">
        <h2 className="text-lg font-semibold">{t("recoveryWallet")}</h2>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          {t("recoveryWalletBody")}
        </p>
        <div className="mt-4 space-y-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-4">
          <div>
            <p className="font-medium text-sm">{t("recoveryPhraseTitle")}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {t("recoveryPhraseBody")}
            </p>
            <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">{t("recoveryPhraseAfter")}</p>
          </div>
          <div>
            <p className="font-medium text-sm">{t("recoveryEmailTitle")}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {t("recoveryEmailBody")}
            </p>
            <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">{t("recoveryEmailSoon")}</p>
          </div>
        </div>
      </section>

      <section className="mt-8" id="verification">
        <h2 className="text-lg font-semibold">{t("verification")}</h2>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          {t("verificationBody")}
        </p>
        <p className="mt-2 text-sm text-gray-400 dark:text-gray-500">{t("verificationPlugin")}</p>
      </section>

      <section className="mt-8" id="bank">
        <h2 className="text-lg font-semibold">{t("bankAccounts")}</h2>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          {t("bankAccountsBody")}
        </p>
        <BankAccountsSection />
      </section>

      <section className="mt-8" id="stores">
        <h2 className="text-lg font-semibold">{t("stores")}</h2>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          {t("storesBody")}
        </p>
        <p className="mt-2 text-sm text-gray-400 dark:text-gray-500">{t("storesDocs")}</p>
      </section>

      <div className="mt-8">
        {usePrivyAuth ? (
          <button
            type="button"
            disabled={signingOut}
            onClick={async () => {
              setSigningOut(true);
              try {
                if (privy.logout) await privy.logout();
              } finally {
                const res = await fetch("/api/auth/logout", { method: "POST", redirect: "manual" });
                const url = res.headers.get("Location");
                window.location.href = url || "/";
              }
            }}
            className="rounded-md border border-red-300 dark:border-red-700 text-red-700 dark:text-red-400 px-3 py-1.5 text-sm disabled:opacity-50"
          >
            {signingOut ? tc("signingOut") : tc("signOut")}
          </button>
        ) : (
          <form action="/api/auth/logout" method="POST">
            <button
              type="submit"
              className="rounded-md border border-red-300 dark:border-red-700 text-red-700 dark:text-red-400 px-3 py-1.5 text-sm"
            >
              {tc("signOut")}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
