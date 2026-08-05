"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import BankAccountsSection from "@/components/BankAccountsSection";
import { useTranslations } from "next-intl";
import { useSignOut } from "@/lib/auth/useSignOut";
import { resolveAccountDisplayName } from "@/lib/display-name";
import { isPasskeyAuth } from "@/lib/auth/provider";
import { ProfileCollapsibleCard } from "@/components/profile/ProfileCollapsibleCard";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

export default function SettingsPage() {
  const t = useTranslations("settingsPage");
  const tc = useTranslations("common");
  const [user, setUser] = useState<{
    email: string;
    username?: string | null;
    twoFactorEnabled?: boolean;
    isPollarUser?: boolean;
  } | null>(null);
  const [pin, setPin] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [pinBusy, setPinBusy] = useState(false);
  const [pinMsg, setPinMsg] = useState<string | null>(null);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [totpCode, setTotpCode] = useState("");
  const [showTotpSetup, setShowTotpSetup] = useState(false);
  const [orgTag, setOrgTag] = useState<string | null>(null);
  const [orgTagInput, setOrgTagInput] = useState("");
  const [orgTagBusy, setOrgTagBusy] = useState(false);
  const [orgTagError, setOrgTagError] = useState<string | null>(null);
  const [orgTagSaved, setOrgTagSaved] = useState(false);
  const [linkedTreasuryAddress, setLinkedTreasuryAddress] = useState<string | null>(null);
  const [inviteRole, setInviteRole] = useState("member");
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteExpires, setInviteExpires] = useState<string | null>(null);
  const { signOut, signingOut } = useSignOut();

  function loadSozuTagInfo() {
    fetch("/api/profile/org/sozu-tag", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: {
        username?: string | null;
        receive?: { tagReceiveAddress?: string | null };
        tag_directory_public_key?: string | null;
      } | null) => {
        if (!d) return;
        const username = typeof d.username === "string" ? d.username : null;
        setOrgTag(username);
        setOrgTagInput(username ? `$${username}` : "");
        const linked =
          (typeof d.receive?.tagReceiveAddress === "string" && d.receive.tagReceiveAddress) ||
          (typeof d.tag_directory_public_key === "string" && d.tag_directory_public_key) ||
          null;
        setLinkedTreasuryAddress(linked);
      })
      .catch(() => {});
  }

  useEffect(() => {
    fetch("/api/profile", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data?.email) return;
        setUser({
          email: data.email,
          username: data.username ?? null,
          twoFactorEnabled: false,
          isPollarUser: !!data.is_pollar_user,
        });
      })
      .catch(() => setUser(null));
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((data) => {
        setTwoFactorEnabled(data.user?.twoFactorEnabled ?? false);
      })
      .catch(() => {});
  }, []);

  async function saveBackupPin() {
    setPinMsg(null);
    if (pin.length < 6 || pin !== pinConfirm) {
      setPinMsg(t("pinMismatch"));
      return;
    }
    setPinBusy(true);
    try {
      const res = await fetch("/api/auth/pin/set", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ pin }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setPin("");
      setPinConfirm("");
      setPinMsg(t("pinSaved"));
    } catch (e) {
      setPinMsg(e instanceof Error ? e.message : "Failed");
    } finally {
      setPinBusy(false);
    }
  }

  async function createStaffInvite() {
    setInviteBusy(true);
    setInviteError(null);
    setInviteUrl(null);
    setInviteExpires(null);
    try {
      const res = await fetch("/api/org/invites", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: inviteRole }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? t("inviteCreateFailed"));
      setInviteUrl(typeof data.url === "string" ? data.url : null);
      setInviteExpires(typeof data.expiresAt === "string" ? data.expiresAt : null);
    } catch (e) {
      setInviteError(e instanceof Error ? e.message : t("inviteCreateFailed"));
    } finally {
      setInviteBusy(false);
    }
  }

  useEffect(() => {
    loadSozuTagInfo();
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
      <section
        className="mt-6 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-4"
        id="language"
      >
        <h2 className="text-lg font-semibold">{t("languageSectionTitle")}</h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t("languageSectionBody")}</p>
        <div className="mt-4 max-w-xs">
          <LanguageSwitcher />
        </div>
      </section>

      <section className="mt-6 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-4" id="personal">
        <h2 className="text-lg font-semibold">{t("personalInfoTitle")}</h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t("personalInfoBody")}</p>
        {user && (
          <dl className="mt-4 space-y-2 text-sm">
            <div>
              <dt className="text-gray-500 dark:text-gray-400">{t("displayNameLabel")}</dt>
              <dd className="font-medium text-gray-900 dark:text-white">
                {resolveAccountDisplayName(user.email, tc("you"), user.username)}
              </dd>
            </div>
            <div>
              <dt className="text-gray-500 dark:text-gray-400">{t("emailLabel")}</dt>
              <dd className="font-medium text-gray-900 dark:text-white break-all">{user.email}</dd>
            </div>
          </dl>
        )}
      </section>

      <section className="mt-8" id="security">
        <h2 className="text-lg font-semibold">{t("security")}</h2>
        {isPasskeyAuth() && !user?.isPollarUser && (
          <div className="mt-4 rounded-lg border border-gray-200 dark:border-gray-600 p-4 space-y-3">
            <p className="text-sm text-gray-600 dark:text-gray-400">{t("backupPinBody")}</p>
            <input
              type="password"
              inputMode="numeric"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 12))}
              placeholder={t("backupPinPlaceholder")}
              className="w-full max-w-xs rounded-md border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm"
            />
            <input
              type="password"
              inputMode="numeric"
              value={pinConfirm}
              onChange={(e) => setPinConfirm(e.target.value.replace(/\D/g, "").slice(0, 12))}
              placeholder={t("backupPinConfirmPlaceholder")}
              className="w-full max-w-xs rounded-md border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm"
            />
            <button
              type="button"
              disabled={pinBusy}
              onClick={saveBackupPin}
              className="rounded-md bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 px-3 py-2 text-sm font-medium disabled:opacity-50"
            >
              {t("backupPinSave")}
            </button>
            {pinMsg ? <p className="text-sm text-gray-600 dark:text-gray-400">{pinMsg}</p> : null}
          </div>
        )}
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
              if (typeof data.tag_receive_address === "string") {
                setLinkedTreasuryAddress(data.tag_receive_address);
              }
              setOrgTagSaved(true);
              loadSozuTagInfo();
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
        {orgTag && linkedTreasuryAddress ? (
          <div className="mt-4 max-w-md rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-4">
            <p className="text-xs text-gray-500 dark:text-gray-400">{t("sozuTagLinkedHint", { tag: `$${orgTag}` })}</p>
            <code className="mt-2 block font-mono text-xs break-all text-gray-800 dark:text-gray-200">
              {linkedTreasuryAddress}
            </code>
          </div>
        ) : orgTag && !linkedTreasuryAddress ? (
          <p className="mt-3 max-w-md text-xs text-amber-700 dark:text-amber-400">{t("sozuTagNotLinkedYet")}</p>
        ) : null}
      </section>

      {user?.isPollarUser ? (
        <section
          className="mt-6 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-4"
          id="staff-invite"
        >
          <h2 className="text-lg font-semibold">{t("inviteTitle")}</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t("inviteBody")}</p>
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <label className="text-sm">
              <span className="block text-gray-500 dark:text-gray-400 mb-1">{t("inviteRoleLabel")}</span>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
                className="rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
              >
                <option value="member">{t("inviteRoleMember")}</option>
                <option value="admin">{t("inviteRoleAdmin")}</option>
                <option value="guardian">{t("inviteRoleGuardian")}</option>
                <option value="treasury_manager">{t("inviteRoleTreasury")}</option>
              </select>
            </label>
            <button
              type="button"
              disabled={inviteBusy}
              onClick={() => void createStaffInvite()}
              className="rounded-md bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              {inviteBusy ? t("inviteCreating") : t("inviteCreate")}
            </button>
          </div>
          {inviteError && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{inviteError}</p>}
          {inviteUrl && (
            <div className="mt-3 space-y-1">
              <p className="text-xs text-gray-500 dark:text-gray-400">{t("inviteLinkReady")}</p>
              <code className="block break-all rounded-md bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 px-3 py-2 text-xs">
                {inviteUrl}
              </code>
              {inviteExpires && (
                <p className="text-xs text-gray-400">
                  {t("inviteExpires", { at: new Date(inviteExpires).toLocaleString() })}
                </p>
              )}
              <button
                type="button"
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                onClick={() => void navigator.clipboard.writeText(inviteUrl)}
              >
                {t("inviteCopy")}
              </button>
            </div>
          )}
        </section>
      ) : null}

      <div className="mt-8" id="recovery">
        <ProfileCollapsibleCard
          title={t("recoveryWallet")}
          summary={t("recoveryWalletBody")}
          openLabel={t("recoveryOpen")}
          closeLabel={t("recoveryClose")}
        >
          <div className="space-y-4">
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
            <Link
              href="/dashboard/profile"
              className="inline-block text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              {t("profileLink")}
            </Link>
          </div>
        </ProfileCollapsibleCard>
      </div>

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
        <button
          type="button"
          disabled={signingOut}
          onClick={() => signOut()}
          className="rounded-md border border-red-300 dark:border-red-700 text-red-700 dark:text-red-400 px-3 py-1.5 text-sm disabled:opacity-50"
        >
          {signingOut ? tc("signingOut") : tc("signOut")}
        </button>
      </div>
    </div>
  );
}
