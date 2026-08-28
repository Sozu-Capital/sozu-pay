"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useSmartAccountKitContext } from "@/components/SmartAccountKitProvider";
import {
  registerSmartAccount,
  resolvePublicKeyFromServer,
} from "@/lib/stellar/smartAccounts/registerWalletClient";

export default function SetupSmartWalletPage() {
  const router = useRouter();
  const t = useTranslations("onboardingPages.smartWallet");
  const tCommon = useTranslations("onboardingPages");
  const [isMerchant, setIsMerchant] = useState(false);
  const {
    ready,
    kit,
    connected,
    contractId,
    credentialId,
    error,
    linkMemberWallet,
    connect,
    createWallet,
  } = useSmartAccountKitContext();
  const [loginCredentialId, setLoginCredentialId] = useState<string | null>(null);

  const [profileEmail, setProfileEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [createStep, setCreateStep] = useState<"device" | "deploy" | null>(null);

  const goBack = useCallback(() => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    router.replace(isMerchant ? "/dashboard" : "/onboarding/create-organization");
  }, [isMerchant, router]);

  useEffect(() => {
    fetch("/api/profile", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const email = typeof d?.email === "string" ? d.email : "";
        if (email) setProfileEmail(email);
        if (d?.is_pollar_user) {
          router.replace("/dashboard");
          return;
        }
        if (d?.org_type === "store") setIsMerchant(true);
      })
      .catch(() => {});

    fetch("/api/auth/passkeys/primary", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (typeof d?.credentialId === "string") setLoginCredentialId(d.credentialId);
      })
      .catch(() => {});
  }, [router]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape" || saving) return;
      e.preventDefault();
      goBack();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goBack, saving]);

  const canProceed = ready && !!kit;
  const passkeyLabel = fullName.trim() || t("primaryPasskey");

  const persistWallet = async (params: {
    contractId: string;
    credentialId: string;
    publicKey: Uint8Array;
  }) => {
    await registerSmartAccount({
      type: "member",
      contractId: params.contractId,
      credentialId: params.credentialId,
      publicKey: params.publicKey,
      label: passkeyLabel,
    });
  };

  const handleCreate = async () => {
    setSaveError(null);
    setSaving(true);
    setCreateStep("device");
    const unsubCreated = kit?.events.on("credentialCreated", () => setCreateStep("deploy"));
    try {
      if (isMerchant) {
        const wallet = await createWallet(
          passkeyLabel,
          profileEmail || fullName.trim() || "merchant",
        );
        setCreateStep("deploy");
        if (!wallet.contractId || !wallet.credentialId || !wallet.publicKey) {
          throw new Error(t("noWalletConnected"));
        }
        await persistWallet({
          contractId: wallet.contractId,
          credentialId: wallet.credentialId,
          publicKey: wallet.publicKey,
        });
      } else {
        const wallet = await linkMemberWallet(loginCredentialId ?? undefined);
        await persistWallet({
          contractId: wallet.contractId,
          credentialId: wallet.credentialId,
          publicKey: wallet.publicKey,
        });
      }
      router.replace("/dashboard");
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : t("failed"));
    } finally {
      unsubCreated?.();
      setSaving(false);
      setCreateStep(null);
    }
  };

  const handleConnectExisting = async () => {
    setSaveError(null);
    setSaving(true);
    try {
      const linked = await connect({ prompt: true });
      if (!linked.contractId || !linked.credentialId) {
        throw new Error(t("noWalletConnected"));
      }
      let publicKey = linked.publicKey;
      if (!publicKey) {
        publicKey = await resolvePublicKeyFromServer({
          contractId: linked.contractId,
          credentialId: linked.credentialId,
        });
      }
      await persistWallet({
        contractId: linked.contractId,
        credentialId: linked.credentialId,
        publicKey,
      });
      router.replace("/dashboard");
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : t("failed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="relative min-h-screen flex items-center justify-center p-4 bg-gray-950 text-white">
      <button
        type="button"
        onClick={goBack}
        disabled={saving}
        className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/80 hover:bg-white/10 hover:text-white disabled:opacity-40"
        aria-label={t("closeAria")}
        title={t("closeAria")}
      >
        <span aria-hidden className="text-lg leading-none">
          ×
        </span>
      </button>
      <div className="w-full max-w-md rounded-xl border border-white/10 bg-white/5 p-6">
        <h1 className="text-lg font-semibold text-white">{isMerchant ? t("titleMerchant") : t("title")}</h1>
        <p className="mt-2 text-sm text-gray-300">{isMerchant ? t("subtitleMerchant") : t("subtitle")}</p>

        <div className="mt-5">
          <label htmlFor="full-name" className="text-xs font-medium text-gray-300">
            {t("fullNameLabel")}
          </label>
          <input
            id="full-name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder={t("fullNamePlaceholder")}
            disabled={saving}
            className="mt-1 w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-white/20 disabled:opacity-50"
          />
          {profileEmail && (
            <p className="mt-1 text-xs text-gray-500">{t("accountLabel", { email: profileEmail })}</p>
          )}
        </div>

        {!canProceed && <p className="mt-4 text-sm text-gray-400">{tCommon("loading")}</p>}
        {createStep === "device" ? (
          <p className="mt-4 text-sm text-gray-300">{t("creatingDevice")}</p>
        ) : null}
        {createStep === "deploy" ? (
          <p className="mt-4 text-sm text-gray-300">{t("creatingDeploy")}</p>
        ) : null}
        {error && !saving ? <p className="mt-4 text-sm text-red-400">{error}</p> : null}
        {saveError && <p className="mt-4 text-sm text-red-400">{saveError}</p>}

        <div className="mt-6 flex flex-col gap-3">
          <button
            type="button"
            disabled={!canProceed || saving}
            onClick={() => void handleCreate()}
            className="rounded-md bg-white text-gray-900 py-2.5 px-4 font-medium disabled:opacity-50"
          >
            {saving
              ? createStep === "deploy"
                ? t("creatingDeployCta")
                : t("creatingDeviceCta")
              : isMerchant
                ? t("linkCtaMerchant")
                : t("linkCta")}
          </button>
          <button
            type="button"
            disabled={!canProceed || saving}
            onClick={() => void handleConnectExisting()}
            className="rounded-md border border-white/20 bg-white/5 py-2.5 px-4 font-medium disabled:opacity-50"
          >
            {isMerchant ? t("connectCtaMerchant") : t("connectCta")}
          </button>
          <button
            type="button"
            onClick={goBack}
            disabled={saving}
            className="py-1 text-center text-xs text-gray-500 hover:text-gray-300 disabled:opacity-40"
          >
            {t("notNow")}
          </button>
          {connected && contractId && (
            <p className="text-xs text-gray-400 break-all">
              {t("connectedContract")}{" "}
              <span className="font-mono">{contractId}</span>
              {credentialId ? (
                <>
                  {" "}
                  · {t("credential")}{" "}
                  <span className="font-mono">{credentialId.slice(0, 12)}…</span>
                </>
              ) : null}
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
