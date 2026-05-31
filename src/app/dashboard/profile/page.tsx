"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { OrgTreasurySetup } from "@/components/OrgTreasurySetup";
import { ProfileAddressRow } from "@/components/profile/ProfileAddressRow";
import { ProfileCollapsibleCard } from "@/components/profile/ProfileCollapsibleCard";
import { resolveAccountDisplayName } from "@/lib/display-name";

type ProfileData = {
  email: string;
  username?: string | null;
  stellar_public_key: string | null;
  stellar_payout_public_key: string | null;
  org_payout_wallet_public_key: string | null;
  org_id: string | null;
  org_name?: string | null;
  org_stellar_disbursement_public_key?: string | null;
  org_has_stored_secret?: boolean;
  org_encryption_type?: "legacy" | "user_derived" | null;
  org_has_recovery?: boolean;
  allowed: boolean;
  admin_level: string;
  member_smart_account_id?: string | null;
  smart_wallet_ready?: boolean;
  org_soroban_contract_id?: string | null;
  activation_requested_at: string | null;
  needsPayoutWalletSetup?: boolean;
};

const STELLAR_EXPERT_BASE =
  process.env.NEXT_PUBLIC_STELLAR_NETWORK === "public"
    ? "https://stellar.expert/explorer/public"
    : "https://stellar.expert/explorer/testnet";

const FRIENDBOT_URL = "https://friendbot.stellar.org";

const REGISTRATION_MESSAGE_PREFIX = "SozuPay wallet registration";

export default function ProfilePage() {
  const t = useTranslations("profilePage");
  const tc = useTranslations("common");
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [requestingActivation, setRequestingActivation] = useState(false);
  const [activationRequested, setActivationRequested] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const [createStep, setCreateStep] = useState<"idle" | "backup" | "registering">("idle");
  const [newKeypair, setNewKeypair] = useState<{ publicKey: string; secretKey: string } | null>(null);
  const [backupConfirmed, setBackupConfirmed] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [creatingOrg, setCreatingOrg] = useState(false);
  const [createOrgError, setCreateOrgError] = useState<string | null>(null);
  const [justCreatedOrgKeys, setJustCreatedOrgKeys] = useState<{ publicKey: string; secretKey: string } | null>(null);
  const [justCreatedOrgSecure, setJustCreatedOrgSecure] = useState<{ publicKey: string } | null>(null);
  const [orgCreateName, setOrgCreateName] = useState("My organization");
  const [orgCreateType, setOrgCreateType] = useState<"store" | "ngo">("ngo");
  const [orgCreatePassword, setOrgCreatePassword] = useState("");
  const [orgCreateWithRecovery, setOrgCreateWithRecovery] = useState(false);
  const [orgCreatedRecoveryCode, setOrgCreatedRecoveryCode] = useState<string | null>(null);
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);
  const [recoveryCodeInput, setRecoveryCodeInput] = useState("");
  const [recoveryNewPassword, setRecoveryNewPassword] = useState("");
  const [recoverySubmitting, setRecoverySubmitting] = useState(false);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const [showMigrationModal, setShowMigrationModal] = useState(false);
  const [migrationSecretInput, setMigrationSecretInput] = useState("");
  const [migrationPasswordInput, setMigrationPasswordInput] = useState("");
  const [migrationSubmitting, setMigrationSubmitting] = useState(false);
  const [migrationError, setMigrationError] = useState<string | null>(null);
  const [revealedOrgSecret, setRevealedOrgSecret] = useState<string | null>(null);
  const [loadingOrgSecret, setLoadingOrgSecret] = useState(false);

  const [showTrustlineModal, setShowTrustlineModal] = useState(false);
  const [trustlineSecretInput, setTrustlineSecretInput] = useState("");
  const [trustlineSigning, setTrustlineSigning] = useState(false);
  const [trustlineError, setTrustlineError] = useState<string | null>(null);
  const [trustlineStatus, setTrustlineStatus] = useState<{
    needs_trustline: boolean;
    has_trustline: boolean;
  } | null>(null);

  const loadProfile = useCallback(() => {
    setLoading(true);
    fetch("/api/profile")
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setProfile(null);
          return;
        }
        setProfile(data);
        setActivationRequested(!!data.activation_requested_at);
      })
      .catch(() => setProfile(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const loadTrustlineStatus = useCallback(() => {
    if (!profile?.stellar_public_key) return;
    fetch("/api/profile/wallet/trustline-status")
      .then((r) => r.json())
      .then((data) => {
        if (typeof data.needs_trustline === "boolean" && typeof data.has_trustline === "boolean") {
          setTrustlineStatus({ needs_trustline: data.needs_trustline, has_trustline: data.has_trustline });
        }
      })
      .catch(() => {});
  }, [profile?.stellar_public_key]);

  useEffect(() => {
    loadTrustlineStatus();
  }, [loadTrustlineStatus]);

  const handleOpenTrustlineSign = () => {
    setTrustlineError(null);
    setTrustlineSecretInput("");
    setShowTrustlineModal(true);
  };

  const handleSubmitTrustline = async () => {
    const secret = trustlineSecretInput.trim();
    if (!secret) {
      setTrustlineError(t("trustlineSecretRequired"));
      return;
    }
    setTrustlineSigning(true);
    setTrustlineError(null);
    try {
      const res = await fetch("/api/profile/wallet/trustline-tx");
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.envelope_xdr) {
        setTrustlineError(data.error ?? t("failedGetTx"));
        return;
      }
      const { Transaction, Keypair: Kp, Networks } = await import("@stellar/stellar-sdk");
      const networkPassphrase = data.network === "public" ? Networks.PUBLIC : Networks.TESTNET;
      const tx = new Transaction(data.envelope_xdr, networkPassphrase);
      const keypair = Kp.fromSecret(secret);
      if (keypair.publicKey() !== profile?.stellar_public_key) {
        setTrustlineError(t("secretMismatchWallet"));
        return;
      }
      tx.sign(keypair);
      const xdr = tx.toEnvelope().toXDR("base64");
      const horizonUrl = data.network === "public" ? "https://horizon.stellar.org" : "https://horizon-testnet.stellar.org";
      const submitRes = await fetch(`${horizonUrl}/transactions`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `tx=${encodeURIComponent(xdr)}`,
      });
      const submitData = await submitRes.json().catch(() => ({}));
      if (!submitRes.ok || submitData.status === "failed") {
        setTrustlineError(submitData.detail ?? submitData.extras?.result_codes?.transaction ?? t("transactionFailed"));
        return;
      }
      setShowTrustlineModal(false);
      setTrustlineSecretInput("");
      setTrustlineStatus({ needs_trustline: false, has_trustline: true });
    } catch (e) {
      setTrustlineError(e instanceof Error ? e.message : t("failedAddTrustline"));
    } finally {
      setTrustlineSigning(false);
    }
  };

  const displayName = resolveAccountDisplayName(
    profile?.email,
    t("userFallback"),
    profile?.username
  );
  const avatarUrl = null;
  const orgDisplayName = profile?.org_name?.trim() || t("organizationFallback");

  const handleRequestActivation = async () => {
    setRequestingActivation(true);
    try {
      const res = await fetch("/api/profile/request-activation", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setActivationRequested(true);
        if (profile) setProfile({ ...profile, activation_requested_at: data.activation_requested_at ?? new Date().toISOString() });
      }
    } finally {
      setRequestingActivation(false);
    }
  };

  const handleCreateWallet = async () => {
    setCreateError(null);
    const { Keypair } = await import("@stellar/stellar-sdk");
    const keypair = Keypair.random();
    setNewKeypair({
      publicKey: keypair.publicKey(),
      secretKey: keypair.secret(),
    });
    setCreateStep("backup");
    setBackupConfirmed(false);
  };

  const handleCreateOrganization = async () => {
    setCreateOrgError(null);
    setCreatingOrg(true);
    try {
      const res = await fetch("/api/profile/org", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "My organization", type: "ngo" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setCreateOrgError(data.error ?? t("failedCreateOrg"));
        return;
      }
      if (data.publicKey && data.secretKey) {
        setJustCreatedOrgKeys({ publicKey: data.publicKey, secretKey: data.secretKey });
      } else {
        loadProfile();
      }
    } finally {
      setCreatingOrg(false);
    }
  };

  const handleCreateOrganizationSecure = async (e: React.FormEvent) => {
    e.preventDefault();
    const passphrase = orgCreatePassword.trim();
    if (!passphrase) {
      setCreateOrgError(t("enterPayoutPasswordOrg"));
      return;
    }
    setCreateOrgError(null);
    setCreatingOrg(true);
    try {
      const { Keypair } = await import("@stellar/stellar-sdk");
      const { encryptOrgSecretClient } = await import("@/lib/org-wallet-client-crypto");
      const keypair = Keypair.random();
      const publicKey = keypair.publicKey();
      const secretKey = keypair.secret();
      const encryptedBlob = await encryptOrgSecretClient(secretKey, passphrase);
      const encryptedSecret = JSON.stringify(encryptedBlob);
      const body: Record<string, unknown> = {
        name: orgCreateName.trim() || "My organization",
        type: orgCreateType,
        publicKey,
        encryptedSecret,
      };
      if (orgCreateWithRecovery) {
        const recoveryCode = `RC-${Date.now().toString(36)}-${crypto.getRandomValues(new Uint8Array(8)).reduce((s, b) => s + b.toString(36), "")}`;
        const recoveryBlob = await encryptOrgSecretClient(secretKey, recoveryCode);
        body.recoveryEncryptedSecret = JSON.stringify(recoveryBlob);
        setOrgCreatedRecoveryCode(recoveryCode);
      }
      const res = await fetch("/api/profile/org", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setCreateOrgError(data.error ?? t("failedCreateOrg"));
        return;
      }
      setJustCreatedOrgSecure({ publicKey });
      setOrgCreatePassword("");
      setOrgCreateWithRecovery(false);
      loadProfile();
    } catch (err) {
      setCreateOrgError(err instanceof Error ? err.message : t("failedCreateOrg"));
    } finally {
      setCreatingOrg(false);
    }
  };

  const handleRecoverySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = recoveryCodeInput.trim();
    const newPass = recoveryNewPassword.trim();
    if (!code || !newPass || !profile?.org_stellar_disbursement_public_key) return;
    setRecoverySubmitting(true);
    setRecoveryError(null);
    try {
      const res = await fetch("/api/profile/org/recovery-encrypted-secret");
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.recoveryEncryptedSecret) {
        setRecoveryError(data.error ?? t("failedLoadRecovery"));
        return;
      }
      const { decryptOrgSecretClient, encryptOrgSecretClient } = await import("@/lib/org-wallet-client-crypto");
      const secretKey = await decryptOrgSecretClient(data.recoveryEncryptedSecret, code);
      const blob = await encryptOrgSecretClient(secretKey, newPass);
      const patchRes = await fetch("/api/profile/org/wallet", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          publicKey: profile.org_stellar_disbursement_public_key,
          encryptedSecret: JSON.stringify(blob),
        }),
      });
      const patchData = await patchRes.json().catch(() => ({}));
      if (!patchRes.ok) {
        setRecoveryError(patchData.error ?? t("failedUpdateWallet"));
        return;
      }
      setShowRecoveryModal(false);
      setRecoveryCodeInput("");
      setRecoveryNewPassword("");
      setRecoveryError(null);
    } catch (err) {
      setRecoveryError(err instanceof Error ? err.message : t("recoveryFailed"));
    } finally {
      setRecoverySubmitting(false);
    }
  };

  const handleMigrationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const secret = migrationSecretInput.trim();
    const pass = migrationPasswordInput.trim();
    if (!secret || !pass || !profile?.org_stellar_disbursement_public_key) return;
    setMigrationSubmitting(true);
    setMigrationError(null);
    try {
      const { Keypair } = await import("@stellar/stellar-sdk");
      const { encryptOrgSecretClient } = await import("@/lib/org-wallet-client-crypto");
      const keypair = Keypair.fromSecret(secret);
      if (keypair.publicKey() !== profile.org_stellar_disbursement_public_key) {
        setMigrationError(t("migrationSecretMismatch"));
        return;
      }
      const blob = await encryptOrgSecretClient(secret, pass);
      const res = await fetch("/api/profile/org/wallet", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          publicKey: profile.org_stellar_disbursement_public_key,
          encryptedSecret: JSON.stringify(blob),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMigrationError(data.error ?? t("failedReSecure"));
        return;
      }
      setShowMigrationModal(false);
      setMigrationSecretInput("");
      setMigrationPasswordInput("");
      setMigrationError(null);
      loadProfile();
    } catch (err) {
      setMigrationError(err instanceof Error ? err.message : t("migrationFailed"));
    } finally {
      setMigrationSubmitting(false);
    }
  };

  const handleRevealOrgSecret = async () => {
    setLoadingOrgSecret(true);
    setRevealedOrgSecret(null);
    try {
      const res = await fetch("/api/profile/org/secret");
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.secretKey) {
        setRevealedOrgSecret(data.secretKey);
      }
    } finally {
      setLoadingOrgSecret(false);
    }
  };

  const handleCopy = (value: string, label: string) => {
    navigator.clipboard.writeText(value);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleConfirmBackupAndRegister = async () => {
    if (!newKeypair || !backupConfirmed) return;
    setCreateStep("registering");
    setCreateError(null);
    const message = `${REGISTRATION_MESSAGE_PREFIX} ${Date.now()}`;
    try {
      const { Keypair } = await import("@stellar/stellar-sdk");
      const keypair = Keypair.fromSecret(newKeypair.secretKey);
      const signature = keypair.sign(Buffer.from(message, "utf8"));
      const res = await fetch("/api/profile/wallet/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stellar_public_key: newKeypair.publicKey,
          message,
          signature: signature.toString("base64"),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setCreateError(data.error ?? t("registrationFailed"));
        setCreateStep("backup");
        return;
      }
      setNewKeypair(null);
      setCreateStep("idle");
      setBackupConfirmed(false);
      loadProfile();
      loadProfile();
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : t("registrationFailed"));
      setCreateStep("backup");
    }
  };

  const handleCancelCreate = () => {
    setCreateStep("idle");
    setNewKeypair(null);
    setBackupConfirmed(false);
    setCreateError(null);
  };

  if (loading) {
    return (
      <div className="text-gray-500 dark:text-gray-400">{t("loadingProfile")}</div>
    );
  }

  if (!profile) {
    return (
      <div>
        <p className="text-red-600 dark:text-red-400">{t("couldNotLoadProfile")}</p>
        <button type="button" onClick={() => loadProfile()} className="mt-2 rounded-md border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-sm">
          {t("retry")}
        </button>
        <Link href="/dashboard" className="mt-3 ml-2 inline-block text-sm text-gray-600 dark:text-gray-400 underline">
          {t("backToDashboard")}
        </Link>
      </div>
    );
  }

  const stellarExplorerUrl = profile.stellar_public_key
    ? `${STELLAR_EXPERT_BASE}/account/${profile.stellar_public_key}`
    : null;

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <Link
          href="/dashboard/settings"
          className="rounded-md border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          {t("settings")}
        </Link>
      </div>

      {/* You — signed-in person */}
      <section className="mt-8 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 p-6">
        <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
          {t("personalSectionLabel")}
        </p>
        <div className="mt-3 flex items-center gap-4">
          <div
            className="h-16 w-16 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-xl font-semibold text-gray-600 dark:text-gray-400 overflow-hidden"
            style={avatarUrl ? { backgroundImage: `url(${avatarUrl})`, backgroundSize: "cover" } : undefined}
          >
            {!avatarUrl && displayName.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-gray-900 dark:text-white truncate">{displayName}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{profile.email}</p>
            <Link
              href="/dashboard/settings#security"
              className="mt-2 inline-block text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              {t("personalInfoLink")}
            </Link>
          </div>
        </div>
        {profile.member_smart_account_id ? (
          <div className="mt-5 pt-5 border-t border-gray-100 dark:border-gray-700/60">
            <ProfileAddressRow
              label={t("passkeySmartAccountLabel")}
              address={profile.member_smart_account_id}
              explorerHref={`${STELLAR_EXPERT_BASE}/contract/${profile.member_smart_account_id}`}
              copiedKey="member-sa"
              activeCopiedKey={copied}
              onCopy={handleCopy}
              copyLabel={tc("copy")}
              copiedLabel={tc("copied")}
            />
          </div>
        ) : (
          <p className="mt-4 text-sm text-amber-700 dark:text-amber-300">
            {t("passkeyWalletMissing")}{" "}
            <Link href="/onboarding/setup-smart-wallet" className="underline">
              {t("setupPasskeyWallet")}
            </Link>
          </p>
        )}
      </section>

      {/* Organization — receive addresses */}
      {profile.org_id ? (
        <section className="mt-6 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 p-6">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
            {t("organizationSectionLabel")}
          </p>
          <h2 className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">{orgDisplayName}</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t("organizationReceiveBody")}</p>
          <div className="mt-4 space-y-4">
            {profile.org_soroban_contract_id ? (
              <ProfileAddressRow
                label={t("orgSorobanReceiveLabel")}
                address={profile.org_soroban_contract_id}
                explorerHref={`${STELLAR_EXPERT_BASE}/contract/${profile.org_soroban_contract_id}`}
                copiedKey="org-soroban"
                activeCopiedKey={copied}
                onCopy={handleCopy}
                copyLabel={tc("copy")}
                copiedLabel={tc("copied")}
              />
            ) : profile.org_stellar_disbursement_public_key ? (
              <ProfileAddressRow
                label={t("orgClassicReceiveLabel")}
                address={profile.org_stellar_disbursement_public_key}
                explorerHref={`${STELLAR_EXPERT_BASE}/account/${profile.org_stellar_disbursement_public_key}`}
                copiedKey="org-classic"
                activeCopiedKey={copied}
                onCopy={handleCopy}
                copyLabel={tc("copy")}
                copiedLabel={tc("copied")}
              />
            ) : (
              <p className="text-sm text-amber-700 dark:text-amber-300">{t("orgNoReceiveAddress")}</p>
            )}
          </div>
          <Link
            href="/dashboard/settings#sozu-tag"
            className="mt-4 inline-block text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            {t("orgTagSettingsLink")}
          </Link>
        </section>
      ) : null}

      {/* Admin payout wallet (super-admin): only needed when org has no disbursement wallet. With org wallet, you approve in one click and the org signs. */}
      {profile.admin_level === "super_admin" && !profile.org_has_stored_secret && (
        <section className="mt-6 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10 p-6">
          <h2 className="text-lg font-semibold">{t("adminPayoutWalletTitle")}</h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            {t("adminPayoutWalletBody")}
          </p>
          {(profile.stellar_payout_public_key || profile.stellar_public_key) ? (
            <div className="mt-4 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <code className="flex-1 min-w-0 font-mono text-sm text-gray-800 dark:text-gray-200 break-all bg-white dark:bg-gray-800 px-2 py-1.5 rounded border border-amber-200 dark:border-amber-800">
                  {profile.stellar_payout_public_key ?? profile.stellar_public_key}
                </code>
                <button
                  type="button"
                  onClick={() => handleCopy(profile.stellar_payout_public_key ?? profile.stellar_public_key!, "admin-payout")}
                  className="rounded-md border border-amber-300 dark:border-amber-700 px-2 py-1.5 text-xs font-medium shrink-0"
                >
                  {copied === "admin-payout" ? tc("copied") : tc("copy")}
                </button>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {t("fundXlmTrustlineBefore")}
                <a
                  href={`${FRIENDBOT_URL}/?addr=${encodeURIComponent(profile.stellar_payout_public_key ?? profile.stellar_public_key ?? "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 dark:text-blue-400 hover:underline"
                >
                  {t("friendbot")}
                </a>
                {t("fundXlmTrustlineAfter")}
              </p>
              <a
                href={`${STELLAR_EXPERT_BASE}/account/${profile.stellar_payout_public_key ?? profile.stellar_public_key}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:underline"
              >
                {t("viewOnStellarExpert")}
              </a>
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              <p className="text-sm text-amber-800 dark:text-amber-200">
                {t("setupWalletPrompt")}
              </p>
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/onboarding/set-payout-wallet"
                  className="rounded-md bg-amber-600 dark:bg-amber-500 text-white px-3 py-2 text-sm font-medium hover:opacity-90"
                >
                  {t("setPassphraseRecommended")}
                </Link>
                <button
                  type="button"
                  onClick={handleCreateWallet}
                  className="rounded-md border border-amber-300 dark:border-amber-700 px-3 py-2 text-sm font-medium hover:bg-amber-100/50 dark:hover:bg-amber-900/20"
                >
                  {t("createNewKeypair")}
                </button>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {t("passphraseVsKeypairNote")}
              </p>
            </div>
          )}
        </section>
      )}

      {/* Create organization (super_admin without org) */}
      {profile.admin_level === "super_admin" && !profile.org_id && !justCreatedOrgKeys && !justCreatedOrgSecure && (
        <section className="mt-6 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 p-6">
          <h2 className="text-lg font-semibold">{t("organizationTitle")}</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {t("organizationIntro")}
          </p>
          <form onSubmit={handleCreateOrganizationSecure} className="mt-4 space-y-4">
            <div>
              <label htmlFor="org-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                {t("orgNameLabel")}
              </label>
              <input
                id="org-name"
                type="text"
                value={orgCreateName}
                onChange={(e) => setOrgCreateName(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
                placeholder={t("orgNamePlaceholder")}
              />
            </div>
            <div>
              <label htmlFor="org-type" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                {t("typeLabel")}
              </label>
              <select
                id="org-type"
                value={orgCreateType}
                onChange={(e) => setOrgCreateType(e.target.value as "store" | "ngo")}
                className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
              >
                <option value="ngo">{t("typeNgo")}</option>
                <option value="store">{t("typeStore")}</option>
              </select>
            </div>
            <div>
              <label htmlFor="org-payout-password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                {t("payoutPasswordOrgLabel")}
              </label>
              <input
                id="org-payout-password"
                type="password"
                value={orgCreatePassword}
                onChange={(e) => setOrgCreatePassword(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
                placeholder={t("payoutPasswordOrgPlaceholder")}
                autoComplete="new-password"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {t("payoutPasswordOrgHint")}
              </p>
            </div>
            <label className="flex items-center gap-2 mt-2">
              <input type="checkbox" checked={orgCreateWithRecovery} onChange={(e) => setOrgCreateWithRecovery(e.target.checked)} className="rounded border-gray-300 dark:border-gray-600" />
              <span className="text-sm">{t("recoveryCheckbox")}</span>
            </label>
            {createOrgError && (
              <p className="text-sm text-red-600 dark:text-red-400" role="alert">
                {createOrgError}
              </p>
            )}
            <button
              type="submit"
              disabled={creatingOrg}
              className="rounded-md bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 px-3 py-2 text-sm font-medium disabled:opacity-50"
            >
              {creatingOrg ? t("creatingOrg") : t("createOrganization")}
            </button>
          </form>
          <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
            {t("legacyFlowPrefix")}{" "}
            <button
              type="button"
              onClick={handleCreateOrganization}
              disabled={creatingOrg}
              className="underline hover:no-underline"
            >
              {t("createWithBackupKey")}
            </button>
          </p>
        </section>
      )}

      {/* Just-created org (secure flow): no secret shown */}
      {justCreatedOrgSecure && (
        <section className="mt-6 rounded-xl border border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-900/10 p-6">
          <h2 className="text-lg font-semibold">{t("orgCreatedTitle")}</h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            {t("orgCreatedBody")}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <code className="flex-1 min-w-0 font-mono text-sm break-all bg-white dark:bg-gray-800 px-2 py-1.5 rounded border border-green-200 dark:border-green-800">
              {justCreatedOrgSecure.publicKey}
            </code>
            <button
              type="button"
              onClick={() => handleCopy(justCreatedOrgSecure.publicKey, "org-pub")}
              className="rounded-md border border-green-300 dark:border-green-700 px-2 py-1.5 text-xs shrink-0"
            >
              {copied === "org-pub" ? tc("copied") : tc("copy")}
            </button>
          </div>
          {orgCreatedRecoveryCode && (
            <div className="mt-4 p-3 rounded border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-200">{t("saveRecoveryCodeTitle")}</p>
              <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">{t("saveRecoveryCodeBody")}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <code className="flex-1 min-w-0 font-mono text-sm break-all">{orgCreatedRecoveryCode}</code>
                <button type="button" onClick={() => handleCopy(orgCreatedRecoveryCode, "recovery")} className="rounded border border-amber-300 dark:border-amber-700 px-2 py-1 text-xs shrink-0">{copied === "recovery" ? tc("copied") : tc("copy")}</button>
              </div>
            </div>
          )}
          <button
            type="button"
            onClick={() => { setJustCreatedOrgSecure(null); setOrgCreatedRecoveryCode(null); loadProfile(); }}
            className="mt-4 rounded-md bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 px-3 py-2 text-sm font-medium"
          >
            {t("continue")}
          </button>
        </section>
      )}

      {/* Just-created org: backup secret (from Profile create-org flow) */}
      {justCreatedOrgKeys && (
        <section className="mt-6 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10 p-6">
          <h2 className="text-lg font-semibold">{t("saveOrgKeyTitle")}</h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            {t("saveOrgKeyBody")}
          </p>
          <div className="mt-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <code className="flex-1 min-w-0 font-mono text-sm break-all bg-white dark:bg-gray-800 px-2 py-1.5 rounded border border-amber-200 dark:border-amber-800">
                {justCreatedOrgKeys.publicKey}
              </code>
              <button type="button" onClick={() => handleCopy(justCreatedOrgKeys.publicKey, "org-pub")} className="rounded-md border border-amber-300 dark:border-amber-700 px-2 py-1.5 text-xs shrink-0">
                {copied === "org-pub" ? tc("copied") : tc("copy")}
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <code className="flex-1 min-w-0 font-mono text-sm break-all bg-red-50 dark:bg-red-950/30 px-2 py-1.5 rounded text-red-800 dark:text-red-200">
                {justCreatedOrgKeys.secretKey}
              </code>
              <button type="button" onClick={() => handleCopy(justCreatedOrgKeys.secretKey, "org-secret")} className="rounded-md border border-red-300 dark:border-red-700 px-2 py-1.5 text-xs shrink-0 text-red-700 dark:text-red-400">
                {copied === "org-secret" ? tc("copied") : tc("copy")}
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={() => { setJustCreatedOrgKeys(null); loadProfile(); }}
            className="mt-4 rounded-md bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 px-3 py-2 text-sm font-medium"
          >
            {t("savedKeyContinue")}
          </button>
        </section>
      )}

      {/* Organization admin: secrets & migration (collapsed by default) */}
      {profile.admin_level === "super_admin" && profile.org_id && profile.org_stellar_disbursement_public_key && (
        <ProfileCollapsibleCard
          title={t("orgAdminWalletTitle")}
          summary={t("orgAdminWalletSummary")}
          openLabel={t("cardOpen")}
          closeLabel={t("cardClose")}
        >
          <p className="text-sm text-gray-500 dark:text-gray-400">{t("orgDisbursementBody")}</p>
          {profile.org_encryption_type === "legacy" && (
            <div className="mt-4">
              <button
                type="button"
                onClick={() => { setShowMigrationModal(true); setMigrationError(null); setMigrationSecretInput(""); setMigrationPasswordInput(""); }}
                className="rounded-md border border-amber-500 dark:border-amber-600 text-amber-700 dark:text-amber-400 px-3 py-2 text-sm font-medium hover:bg-amber-50 dark:hover:bg-amber-900/20"
              >
                {t("reSecureButton")}
              </button>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {t("reSecureHint")}
              </p>
            </div>
          )}
          {profile.org_encryption_type === "user_derived" && profile.org_has_recovery && (
            <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">
              {t("forgotPayoutPassword")}{" "}
              <button
                type="button"
                onClick={() => { setShowRecoveryModal(true); setRecoveryError(null); setRecoveryCodeInput(""); setRecoveryNewPassword(""); }}
                className="text-blue-600 dark:text-blue-400 hover:underline"
              >
                {t("resetWithRecovery")}
              </button>
            </p>
          )}
          {profile.org_has_stored_secret && profile.org_encryption_type !== "user_derived" && (
            <div className="mt-4">
              <button
                type="button"
                onClick={handleRevealOrgSecret}
                disabled={loadingOrgSecret}
                className="rounded-md border border-amber-500 dark:border-amber-600 text-amber-700 dark:text-amber-400 px-3 py-2 text-sm font-medium hover:bg-amber-50 dark:hover:bg-amber-900/20 disabled:opacity-50"
              >
                {loadingOrgSecret ? t("loadingShort") : t("revealOrgSecret")}
              </button>
              {revealedOrgSecret && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <code className="flex-1 min-w-0 font-mono text-sm break-all bg-red-50 dark:bg-red-950/30 px-2 py-1.5 rounded text-red-800 dark:text-red-200">
                    {revealedOrgSecret}
                  </code>
                  <button
                    type="button"
                    onClick={() => handleCopy(revealedOrgSecret, "revealed-secret")}
                    className="rounded-md border border-red-300 dark:border-red-700 px-2 py-1.5 text-xs text-red-700 dark:text-red-400 shrink-0"
                  >
                    {copied === "revealed-secret" ? tc("copied") : tc("copy")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setRevealedOrgSecret(null)}
                    className="rounded-md border border-gray-300 dark:border-gray-600 px-2 py-1.5 text-xs shrink-0"
                  >
                    {t("hide")}
                  </button>
                </div>
              )}
            </div>
          )}
        </ProfileCollapsibleCard>
      )}

      {profile.admin_level === "super_admin" && profile.org_id && (
        <ProfileCollapsibleCard
          title={t("treasuryCardTitle")}
          summary={t("treasuryCardSummary")}
          openLabel={t("cardOpen")}
          closeLabel={t("cardClose")}
        >
          <OrgTreasurySetup isSuperAdmin />
        </ProfileCollapsibleCard>
      )}

      {/* Org payout wallet from env (optional; when set, Classic payouts can use this shared org key) */}
      {profile.org_payout_wallet_public_key && profile.admin_level === "super_admin" && (
        <section className="mt-6 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10 p-6">
          <h2 className="text-lg font-semibold">{t("orgPayoutWalletTitle")}</h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            {t("orgPayoutWalletBody")}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <code className="flex-1 min-w-0 font-mono text-sm text-gray-800 dark:text-gray-200 break-all bg-white dark:bg-gray-800 px-2 py-1.5 rounded border border-amber-200 dark:border-amber-800">
              {profile.org_payout_wallet_public_key}
            </code>
            <button
              type="button"
              onClick={() => handleCopy(profile.org_payout_wallet_public_key!, "org")}
              className="rounded-md border border-amber-300 dark:border-amber-700 px-2 py-1.5 text-xs font-medium shrink-0"
            >
              {copied === "org" ? tc("copied") : tc("copy")}
            </button>
          </div>
          <a
            href={`${STELLAR_EXPERT_BASE}/account/${profile.org_payout_wallet_public_key}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            {t("viewOnStellarExpert")}
          </a>
        </section>
      )}

      {profile.smart_wallet_ready && (
        <p className="mt-6 text-sm text-gray-500 dark:text-gray-400">
          {t("passkeyWalletReady")}
        </p>
      )}

      {/* Modal: recovery — enter recovery code and new payout password */}
      {showRecoveryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" role="dialog" aria-modal="true" aria-labelledby="recovery-modal-title">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6">
            <h2 id="recovery-modal-title" className="text-lg font-semibold text-gray-900 dark:text-white">{t("resetPayoutPasswordTitle")}</h2>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{t("resetPayoutPasswordBody")}</p>
            <form onSubmit={handleRecoverySubmit} className="mt-4 space-y-3">
              <div>
                <label htmlFor="recovery-code" className="block text-sm font-medium">{t("recoveryCodeLabel")}</label>
                <input id="recovery-code" type="text" value={recoveryCodeInput} onChange={(e) => setRecoveryCodeInput(e.target.value)} className="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2" autoComplete="off" />
              </div>
              <div>
                <label htmlFor="recovery-new-password" className="block text-sm font-medium">{t("newPayoutPasswordLabel")}</label>
                <input id="recovery-new-password" type="password" value={recoveryNewPassword} onChange={(e) => setRecoveryNewPassword(e.target.value)} className="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2" autoComplete="new-password" />
              </div>
              {recoveryError && <p className="text-sm text-red-600 dark:text-red-400" role="alert">{recoveryError}</p>}
              <div className="flex gap-2">
                <button type="submit" disabled={recoverySubmitting || !recoveryCodeInput.trim() || !recoveryNewPassword.trim()} className="rounded-md bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 px-4 py-2 text-sm font-medium disabled:opacity-50">{recoverySubmitting ? t("resetting") : t("resetPassword")}</button>
                <button type="button" onClick={() => { setShowRecoveryModal(false); setRecoveryError(null); }} className="rounded-md border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm">{tc("cancel")}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: migration — paste secret and set payout password */}
      {showMigrationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" role="dialog" aria-modal="true" aria-labelledby="migration-modal-title">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6">
            <h2 id="migration-modal-title" className="text-lg font-semibold text-gray-900 dark:text-white">{t("migrationModalTitle")}</h2>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{t("migrationModalBody")}</p>
            <form onSubmit={handleMigrationSubmit} className="mt-4 space-y-3">
              <div>
                <label htmlFor="migration-secret" className="block text-sm font-medium">{t("orgWalletSecretLabel")}</label>
                <input id="migration-secret" type="password" value={migrationSecretInput} onChange={(e) => setMigrationSecretInput(e.target.value)} placeholder="S..." className="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 font-mono text-sm" autoComplete="off" />
              </div>
              <div>
                <label htmlFor="migration-password" className="block text-sm font-medium">{t("newPayoutPasswordLabel")}</label>
                <input id="migration-password" type="password" value={migrationPasswordInput} onChange={(e) => setMigrationPasswordInput(e.target.value)} className="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2" autoComplete="new-password" />
              </div>
              {migrationError && <p className="text-sm text-red-600 dark:text-red-400" role="alert">{migrationError}</p>}
              <div className="flex gap-2">
                <button type="submit" disabled={migrationSubmitting || !migrationSecretInput.trim() || !migrationPasswordInput.trim()} className="rounded-md bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 px-4 py-2 text-sm font-medium disabled:opacity-50">{migrationSubmitting ? t("reSecuring") : t("reSecureWallet")}</button>
                <button type="button" onClick={() => { setShowMigrationModal(false); setMigrationError(null); }} className="rounded-md border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm">{tc("cancel")}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: authenticate to sign transaction (wallet secret, not stored) */}
      {showTrustlineModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" role="dialog" aria-modal="true" aria-labelledby="trustline-modal-title">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6">
            <h2 id="trustline-modal-title" className="text-lg font-semibold text-gray-900 dark:text-white">
              {t("signTransactionTitle")}
            </h2>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              {t("signTransactionBody")}
            </p>
            <input
              type="password"
              value={trustlineSecretInput}
              onChange={(e) => setTrustlineSecretInput(e.target.value)}
              placeholder={t("secretKeyPlaceholderShort")}
              className="mt-4 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-500"
              autoComplete="off"
            />
            {trustlineError && (
              <p className="mt-2 text-sm text-red-600 dark:text-red-400" role="alert">
                {trustlineError}
              </p>
            )}
            <div className="mt-6 flex flex-wrap gap-2 justify-end">
              <button
                type="button"
                onClick={() => {
                  setShowTrustlineModal(false);
                  setTrustlineError(null);
                  setTrustlineSecretInput("");
                }}
                disabled={trustlineSigning}
                className="rounded-md border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 disabled:opacity-50"
              >
                {tc("cancel")}
              </button>
              <button
                type="button"
                onClick={handleSubmitTrustline}
                disabled={trustlineSigning || !trustlineSecretInput.trim()}
                className="rounded-md bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 px-3 py-2 text-sm font-medium disabled:opacity-50"
              >
                {trustlineSigning ? t("signing") : t("signAndSubmit")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
