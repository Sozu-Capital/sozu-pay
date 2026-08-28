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
import { useDashboardProfile } from "@/contexts/DashboardProfileContext";
import { isFakePollarStaffWallet } from "@/lib/pollar/types";

export default function SettingsPage() {
  const t = useTranslations("settingsPage");
  const tc = useTranslations("common");
  const dashboardProfile = useDashboardProfile();
  const orgName = dashboardProfile?.profile?.org_name ?? null;
  const orgType = dashboardProfile?.profile?.org_type ?? null;
  const hasOrg = !!dashboardProfile?.profile?.org_id;
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
  const [orgTagStubTreasury, setOrgTagStubTreasury] = useState(false);
  const [inviteRole, setInviteRole] = useState("member");
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [inviteOrgName, setInviteOrgName] = useState<string | null>(null);
  const [inviteShareText, setInviteShareText] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteExpires, setInviteExpires] = useState<string | null>(null);
  const [inviteCopied, setInviteCopied] = useState(false);
  const [members, setMembers] = useState<Array<{ id: number; email: string; admin_level: string; role: string }>>([]);
  const [memberBusyId, setMemberBusyId] = useState<number | null>(null);
  const [memberMsg, setMemberMsg] = useState<string | null>(null);
  const [emailDraft, setEmailDraft] = useState("");
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailMsg, setEmailMsg] = useState<string | null>(null);
  const { signOut, signingOut } = useSignOut();

  function loadSozuTagInfo() {
    fetch("/api/profile/org/sozu-tag", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: {
        username?: string | null;
        receive?: { tagReceiveAddress?: string | null };
        tag_directory_public_key?: string | null;
        warnings?: string[];
      } | null) => {
        if (!d) return;
        const username = typeof d.username === "string" ? d.username : null;
        setOrgTag(username);
        setOrgTagInput(username ? `$${username}` : "");
        const rawLinked =
          (typeof d.receive?.tagReceiveAddress === "string" && d.receive.tagReceiveAddress) ||
          (typeof d.tag_directory_public_key === "string" && d.tag_directory_public_key) ||
          null;
        // Never display the fake Pollar sentinel as a working treasury.
        setLinkedTreasuryAddress(
          rawLinked && !isFakePollarStaffWallet(rawLinked) ? rawLinked : null,
        );
        setOrgTagStubTreasury(
          Array.isArray(d.warnings) &&
            (d.warnings.includes("fake_pollar_treasury") ||
              d.warnings.includes("tag_directory_fake_wallet")),
        );
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
        setEmailDraft(data.email);
      })
      .catch(() => setUser(null));
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((data) => {
        setTwoFactorEnabled(data.user?.twoFactorEnabled ?? false);
      })
      .catch(() => {});
    fetch("/api/org/members", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : { members: [] }))
      .then((d) =>
        setMembers(
          Array.isArray(d.members)
            ? d.members.map((m: { id: number; email: string; admin_level: string; role?: string }) => ({
                id: m.id,
                email: m.email,
                admin_level: m.admin_level,
                role: m.role ?? (m.admin_level === "user" ? "member" : "admin"),
              }))
            : [],
        ),
      )
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

  async function copyInviteLink(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setInviteCopied(true);
      window.setTimeout(() => setInviteCopied(false), 2000);
    } catch {
      setInviteError(t("inviteCopyFailed"));
    }
  }

  async function shareInviteLink(url: string) {
    const text = inviteShareText ?? url;
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title: t("inviteTitle"), url, text });
        return;
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
    }
    await copyInviteLink(url);
  }

  async function createStaffInvite() {
    setInviteBusy(true);
    setInviteError(null);
    setInviteUrl(null);
    setInviteOrgName(null);
    setInviteShareText(null);
    setInviteExpires(null);
    setInviteCopied(false);
    try {
      const res = await fetch("/api/org/invites", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: inviteRole }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? t("inviteCreateFailed"));
      const url = typeof data.url === "string" ? data.url : null;
      setInviteUrl(url);
      setInviteOrgName(typeof data.orgName === "string" ? data.orgName : orgName);
      setInviteShareText(typeof data.shareText === "string" ? data.shareText : null);
      setInviteExpires(typeof data.expiresAt === "string" ? data.expiresAt : null);
      if (url) await copyInviteLink(url);
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
        <h1 className="text-2xl font-bold text-white">{t("title")}</h1>
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
        <h2 className="text-lg font-semibold text-white">{t("languageSectionTitle")}</h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t("languageSectionBody")}</p>
        <div className="mt-4 max-w-xs">
          <LanguageSwitcher />
        </div>
      </section>

      <section className="mt-6 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-4" id="personal">
        <h2 className="text-lg font-semibold text-white">{t("personalInfoTitle")}</h2>
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
              {user.isPollarUser ? (
                <dd className="mt-1 space-y-2">
                  <p className="text-xs text-gray-500 dark:text-gray-400">{t("emailChangeHint")}</p>
                  <form
                    className="flex flex-wrap items-center gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      setEmailBusy(true);
                      setEmailMsg(null);
                      fetch("/api/profile/email", {
                        method: "PATCH",
                        credentials: "include",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ email: emailDraft }),
                      })
                        .then(async (res) => {
                          const data = await res.json().catch(() => ({}));
                          if (!res.ok) throw new Error(data.error ?? t("emailFailed"));
                          setUser((u) => (u ? { ...u, email: data.email } : u));
                          setEmailMsg(t("emailSaved"));
                        })
                        .catch((err) => setEmailMsg(err instanceof Error ? err.message : t("emailFailed")))
                        .finally(() => setEmailBusy(false));
                    }}
                  >
                    <input
                      type="email"
                      value={emailDraft}
                      onChange={(e) => setEmailDraft(e.target.value)}
                      className="w-full max-w-md rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                    />
                    <button
                      type="submit"
                      disabled={emailBusy}
                      className="rounded-md bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 px-3 py-1.5 text-sm disabled:opacity-50"
                    >
                      {emailBusy ? t("sozuTagSaving") : t("emailSave")}
                    </button>
                  </form>
                  {emailMsg ? <p className="text-xs text-gray-500 dark:text-gray-400">{emailMsg}</p> : null}
                </dd>
              ) : (
                <dd className="font-medium text-gray-900 dark:text-white break-all">{user.email}</dd>
              )}
            </div>
          </dl>
        )}
      </section>

      <section className="mt-8" id="security">
        <h2 className="text-lg font-semibold text-white">{t("security")}</h2>
        {(user?.isPollarUser || dashboardProfile?.profile?.is_pollar_user) && (
          <div className="mt-4 rounded-lg border border-gray-200 dark:border-gray-600 p-4 space-y-3">
            <p className="text-sm font-medium text-gray-900 dark:text-white">{t("biometricTitle")}</p>
            {dashboardProfile?.profile?.smart_wallet_ready ? (
              <p className="text-sm text-gray-600 dark:text-gray-400">{t("biometricOn")}</p>
            ) : (
              <>
                <p className="text-sm text-gray-600 dark:text-gray-400">{t("biometricBody")}</p>
                <Link
                  href="/onboarding/setup-smart-wallet"
                  className="inline-flex rounded-md bg-gray-900 dark:bg-gray-100 px-3 py-2 text-sm font-medium text-white dark:text-gray-900"
                >
                  {t("biometricCta")}
                </Link>
              </>
            )}
          </div>
        )}
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
        <h2 className="text-lg font-semibold text-white">{t("sozuTagTitle")}</h2>
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
                setLinkedTreasuryAddress(
                  isFakePollarStaffWallet(data.tag_receive_address)
                    ? null
                    : data.tag_receive_address,
                );
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
        {orgTagStubTreasury ? (
          <p className="mt-3 max-w-md text-xs text-amber-700 dark:text-amber-400">{t("sozuTagStubTreasury")}</p>
        ) : orgTag && linkedTreasuryAddress ? (
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
          <h2 className="text-lg font-semibold text-white">{t("inviteTitle")}</h2>
          <p className="mt-1 text-sm text-white/70">{t("inviteBody")}</p>
          {orgName ? (
            <p className="mt-2 text-sm font-medium text-white">
              {t("inviteForOrg", { org: orgName })}
            </p>
          ) : null}
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <label className="text-sm">
              <span className="mb-1 block text-white/70">{t("inviteRoleLabel")}</span>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
                className="rounded-md border border-white/20 bg-black/40 px-3 py-2 text-sm text-white"
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
              className="rounded-md bg-white px-4 py-2 text-sm font-medium text-black disabled:opacity-50"
            >
              {inviteBusy ? t("inviteCreating") : t("inviteCreate")}
            </button>
          </div>
          {inviteError && <p className="mt-2 text-sm text-red-300">{inviteError}</p>}
          {inviteUrl && (
            <div className="mt-3 space-y-2">
              <p className="text-xs text-white/60">
                {t("inviteLinkJoins", { org: inviteOrgName ?? orgName ?? "" })}
              </p>
              <input
                readOnly
                value={inviteUrl}
                onFocus={(e) => e.currentTarget.select()}
                className="w-full break-all rounded-md border border-white/20 bg-black/50 px-3 py-2 font-mono text-xs text-white"
                aria-label={t("inviteLinkReady")}
              />
              {inviteExpires && (
                <p className="text-xs text-white/50">
                  {t("inviteExpires", { at: new Date(inviteExpires).toLocaleString() })}
                </p>
              )}
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  className="text-sm text-white underline underline-offset-2 hover:text-white/80"
                  onClick={() => void copyInviteLink(inviteUrl)}
                >
                  {inviteCopied ? t("inviteCopied") : t("inviteCopy")}
                </button>
                <button
                  type="button"
                  className="text-sm text-white underline underline-offset-2 hover:text-white/80"
                  onClick={() => void shareInviteLink(inviteUrl)}
                >
                  {t("inviteShare")}
                </button>
              </div>
            </div>
          )}
        </section>
      ) : null}

      {user?.isPollarUser && members.length > 0 ? (
        <section className="mt-6 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-4" id="roles">
          <h2 className="text-lg font-semibold text-white">{t("rolesTitle")}</h2>
          <p className="mt-1 text-sm text-gray-300">{t("rolesBody")}</p>
          <ul className="mt-4 space-y-3">
            {members.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center gap-3 text-sm">
                <span className="min-w-[12rem] break-all text-white">{m.email}</span>
                <select
                  defaultValue={m.role === "owner" ? "admin" : m.role}
                  disabled={memberBusyId === m.id}
                  className="rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2"
                  onChange={(e) => {
                    const role = e.target.value;
                    setMemberBusyId(m.id);
                    setMemberMsg(null);
                    fetch("/api/org/members", {
                      method: "PATCH",
                      credentials: "include",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ userId: m.id, role }),
                    })
                      .then(async (res) => {
                        const data = await res.json().catch(() => ({}));
                        if (!res.ok) throw new Error(data.error ?? t("rolesFailed"));
                        setMemberMsg(t("rolesSaved"));
                      })
                      .catch((err) => setMemberMsg(err instanceof Error ? err.message : t("rolesFailed")))
                      .finally(() => setMemberBusyId(null));
                  }}
                >
                  <option value="member">{t("inviteRoleMember")}</option>
                  <option value="admin">{t("inviteRoleAdmin")}</option>
                  <option value="treasury_manager">{t("inviteRoleTreasury")}</option>
                  <option value="guardian">{t("inviteRoleGuardian")}</option>
                </select>
              </li>
            ))}
          </ul>
          {memberMsg ? <p className="mt-2 text-sm text-gray-300">{memberMsg}</p> : null}
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
        <h2 className="text-lg font-semibold text-white">{t("verification")}</h2>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          {t("verificationBody")}
        </p>
        <p className="mt-2 text-sm text-gray-400 dark:text-gray-500">{t("verificationPlugin")}</p>
      </section>

      <section className="mt-8" id="bank">
        <h2 className="text-lg font-semibold text-white">{t("bankAccounts")}</h2>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          {t("bankAccountsBody")}
        </p>
        <BankAccountsSection />
      </section>

      <section className="mt-8" id="stores">
        <h2 className="text-lg font-semibold text-white">{t("stores")}</h2>
        {hasOrg ? (
          <div className="mt-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {orgName || t("storesCurrentFallback")}
              </p>
              <span className="inline-flex rounded-full bg-gray-100 dark:bg-gray-700 px-2 py-0.5 text-xs font-medium uppercase tracking-wide text-gray-700 dark:text-gray-200">
                {orgType === "store" ? t("storesTypeBadge") : t("storesTypeBadgeNgo")}
              </span>
            </div>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              {orgType === "store" ? t("storesBodyStore") : t("storesBodyOrg")}
            </p>
            {orgType === "store" && (
              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  href="/dashboard/pos"
                  className="inline-flex rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 text-sm font-medium transition-colors"
                >
                  {t("storesCtaPos")}
                </Link>
                <Link
                  href="/dashboard/qr-codes"
                  className="inline-flex rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-sm font-medium text-gray-800 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  {t("storesCtaQr")}
                </Link>
              </div>
            )}
            <div className="mt-4 flex flex-wrap gap-3 text-sm">
              <Link
                href="/onboarding/organizations"
                className="font-medium text-emerald-700 dark:text-emerald-400 underline-offset-2 hover:underline"
              >
                {t("storesSwitchOrg")}
              </Link>
              <Link
                href="/onboarding/create-organization"
                className="font-medium text-emerald-700 dark:text-emerald-400 underline-offset-2 hover:underline"
              >
                {t("storesCreateAnother")}
              </Link>
            </div>
          </div>
        ) : (
          <div className="mt-3 space-y-2">
            <p className="text-sm text-gray-500 dark:text-gray-400">{t("storesNoOrg")}</p>
            <Link
              href="/onboarding/create-organization"
              className="inline-flex text-sm font-medium text-emerald-700 dark:text-emerald-400 underline-offset-2 hover:underline"
            >
              {t("storesCreateCta")}
            </Link>
          </div>
        )}
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
