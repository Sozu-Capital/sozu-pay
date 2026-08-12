"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PollarCreateOrganizationForm } from "@/components/onboarding/PollarCreateOrganizationForm";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { DarkGradientBg } from "@/components/ui/elegant-dark-pattern";
import { useSmartAccountKitContext } from "@/components/SmartAccountKitProvider";
import { checkUsernameAvailable } from "@/lib/auth/passkey-client";
import { registerSmartAccount } from "@/lib/stellar/smartAccounts/registerWalletClient";
import { resolvePublicKeyFromServer } from "@/lib/stellar/smartAccounts/registerWalletClient";
import { suggestOrgTagFromOrgName } from "@/lib/sozu-tag-suggest";
import { normalizeCredentialId } from "@/lib/webauthn/utils";
import {
  OrgCreateSetupProgress,
  type OrgSetupStepKey,
} from "@/components/onboarding/OrgCreateSetupProgress";
import { OrgFundPaymentModal } from "@/components/onboarding/OrgFundPaymentModal";
import { getClientSignupIntent, clearClientSignupIntent } from "@/lib/auth/signup-intent";

type TaxEntityType = "private_company" | "ngo";
type InviteRole = "member" | "admin" | "guardian" | "treasury_manager";
type InviteRow = { email: string; role: InviteRole };

type SetupStep =
  | "idle"
  | "passkey"
  | "org"
  | "register"
  | "treasury"
  | "sozuTag"
  | "done"
  | "error";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function normalizeOrgTagInput(raw: string): string {
  return raw.replace(/^\$+/, "").trim().toLowerCase();
}

function isValidOrgTag(tag: string): boolean {
  return /^[a-z0-9_]{3,30}$/.test(tag);
}

export default function CreateOrganizationPage() {
  const router = useRouter();
  const t = useTranslations("onboardingPages.createOrg");
  const [authMode, setAuthMode] = useState<"loading" | "pollar" | "passkey">("loading");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/profile", { credentials: "include", cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        setAuthMode(data.is_pollar_user ? "pollar" : "passkey");
      } catch {
        if (!cancelled) setAuthMode("passkey");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (authMode === "loading") {
    return (
      <DarkGradientBg>
        <main className="flex min-h-screen items-center justify-center p-4 text-white">
          <p className="text-sm text-gray-300">…</p>
        </main>
      </DarkGradientBg>
    );
  }

  if (authMode === "pollar") {
    return <PollarCreateOrganizationForm />;
  }

  return <PasskeyCreateOrganizationPage />;
}

function PasskeyCreateOrganizationPage() {
  const router = useRouter();
  const t = useTranslations("onboardingPages.createOrg");
  const {
    ready,
    kit,
    connected,
    contractId: kitContractId,
    credentialId: kitCredentialId,
    linkMemberWallet,
    error: kitError,
  } = useSmartAccountKitContext();
  const [fundModalOpen, setFundModalOpen] = useState(false);

  // Check signup intent on mount (cookie + sessionStorage from /merchants)
  const signupIntent = useMemo(() => getClientSignupIntent(), []);
  const isMerchantIntent = signupIntent === "merchant";

  const [orgName, setOrgName] = useState("");
  const [taxOpen, setTaxOpen] = useState(false);
  const [taxEntityType, setTaxEntityType] = useState<TaxEntityType>(
    isMerchantIntent ? "private_company" : "ngo"
  );
  const [taxLegalName, setTaxLegalName] = useState("");
  const [taxId, setTaxId] = useState("");
  const [taxAddress, setTaxAddress] = useState("");
  const [taxCity, setTaxCity] = useState("");
  const [taxState, setTaxState] = useState("");
  const [taxCountry, setTaxCountry] = useState("");
  const [orgSozuTagInput, setOrgSozuTagInput] = useState("");
  const orgTagEditedRef = useRef(false);
  const [orgTagAvailable, setOrgTagAvailable] = useState<boolean | null>(null);
  const [orgTagCheckError, setOrgTagCheckError] = useState("");
  const [orgTagChecking, setOrgTagChecking] = useState(false);
  const [guardianThreshold, setGuardianThreshold] = useState(2);
  const [invitesText, setInvitesText] = useState("");
  const [userSozuTag, setUserSozuTag] = useState<string | null>(null);
  const [loginCredentialId, setLoginCredentialId] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");

  const [step, setStep] = useState<SetupStep>("idle");
  const [error, setError] = useState("");
  const [treasuryContractId, setTreasuryContractId] = useState<string | null>(null);
  const [memberContractId, setMemberContractId] = useState<string | null>(null);
  const [orgSozuTag, setOrgSozuTag] = useState<string | null>(null);
  const [orgTagReceiveAddress, setOrgTagReceiveAddress] = useState<string | null>(null);

  const orgTagNormalized = useMemo(() => normalizeOrgTagInput(orgSozuTagInput), [orgSozuTagInput]);

  const invites: InviteRow[] = useMemo(() => {
    const emails = invitesText
      .split(/[\n,;]+/)
      .map(normalizeEmail)
      .filter((e) => e.includes("@"));
    const uniq = Array.from(new Set(emails));
    return uniq.map((email) => ({ email, role: "member" as const }));
  }, [invitesText]);

  useEffect(() => {
    const defaultName = isMerchantIntent ? t("defaultOrgNameMerchant") : t("defaultOrgName");
    setOrgName((prev) => {
      const name = prev || defaultName;
      if (!orgTagEditedRef.current) {
        setOrgSozuTagInput(suggestOrgTagFromOrgName(name));
      }
      return name;
    });
  }, [t, isMerchantIntent]);

  function handleOrgNameChange(value: string) {
    setOrgName(value);
    if (!orgTagEditedRef.current) {
      setOrgSozuTagInput(suggestOrgTagFromOrgName(value));
    }
  }

  function handleOrgTagChange(value: string) {
    orgTagEditedRef.current = true;
    setOrgSozuTagInput(value);
  }

  useEffect(() => {
    fetch("/api/profile", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const tag = typeof d?.username === "string" ? d.username.replace(/^\$/, "") : "";
        if (tag) setUserSozuTag(tag);
      })
      .catch(() => {});

    fetch("/api/auth/passkeys/primary", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (typeof d?.credentialId === "string") setLoginCredentialId(d.credentialId);
        if (typeof d?.username === "string") {
          const tag = d.username.replace(/^\$/, "");
          if (tag) setUserSozuTag((prev) => prev ?? tag);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!orgTagNormalized) {
      setOrgTagAvailable(null);
      setOrgTagCheckError("");
      return;
    }
    if (!isValidOrgTag(orgTagNormalized)) {
      setOrgTagAvailable(false);
      setOrgTagCheckError(t("orgSozuTagInvalid"));
      return;
    }

    let cancelled = false;
    setOrgTagChecking(true);
    const timer = setTimeout(() => {
      checkUsernameAvailable(orgTagNormalized, "org")
        .then((res) => {
          if (cancelled) return;
          setOrgTagAvailable(res.available);
          setOrgTagCheckError(res.available ? "" : (res.error ?? t("orgSozuTagTaken")));
        })
        .catch(() => {
          if (cancelled) return;
          setOrgTagAvailable(null);
          setOrgTagCheckError(t("orgSozuTagCheckFailed"));
        })
        .finally(() => {
          if (!cancelled) setOrgTagChecking(false);
        });
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [orgTagNormalized, t]);

  const isBusy = step !== "idle" && step !== "done" && step !== "error";
  const orgTagReady =
    isValidOrgTag(orgTagNormalized) && orgTagAvailable === true && !orgTagChecking;
  const canStart =
    ready &&
    !!kit &&
    !isBusy &&
    orgName.trim().length > 0 &&
    fullName.trim().length > 0 &&
    orgTagReady;

  async function resolveMemberWallet(): Promise<{
    contractId: string;
    credentialId: string;
    publicKey: Uint8Array;
  }> {
    const loginId = loginCredentialId?.trim() || null;
    if (
      kit &&
      connected &&
      kitContractId &&
      kitCredentialId &&
      (!loginId ||
        normalizeCredentialId(kitCredentialId) === normalizeCredentialId(loginId))
    ) {
      try {
        const publicKey = await resolvePublicKeyFromServer({
          contractId: kitContractId,
          credentialId: kitCredentialId,
        });
        return {
          contractId: kitContractId,
          credentialId: kitCredentialId,
          publicKey,
        };
      } catch {
        // fall through to link/deploy
      }
    }
    return linkMemberWallet(loginId ?? undefined);
  }

  const setupStepLabels: Partial<Record<OrgSetupStepKey, string>> = {
    org: t("stepsShort.org"),
    passkey: t("stepsShort.passkey"),
    register: t("stepsShort.register"),
    treasury: t("stepsShort.treasury"),
    sozuTag: t("stepsShort.sozuTag"),
  };

  async function handleCreate() {
    if (!kit || !fullName.trim() || !orgTagReady) return;
    setError("");

    try {
      setStep("org");
      const orgRes = await fetch("/api/profile/org", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: orgName,
          guardianThreshold,
          invites,
          ...(isMerchantIntent
            ? {
                type: "store",
                ...(taxOpen && {
                  tax: {
                    entityType: "private_company",
                    legalName: taxLegalName.trim() || undefined,
                    taxId: taxId.trim() || undefined,
                    registeredAddress: taxAddress.trim() || undefined,
                    city: taxCity.trim() || undefined,
                    state: taxState.trim() || undefined,
                    country: taxCountry.trim() || undefined,
                  },
                }),
              }
            : {
                ...(taxOpen && {
                  tax: {
                    entityType: taxEntityType,
                    legalName: taxLegalName.trim() || undefined,
                    taxId: taxId.trim() || undefined,
                    registeredAddress: taxAddress.trim() || undefined,
                    city: taxCity.trim() || undefined,
                    state: taxState.trim() || undefined,
                    country: taxCountry.trim() || undefined,
                  },
                }),
              }),
        }),
      });
      const orgData = await orgRes.json().catch(() => ({}));
      if (orgRes.status === 401 || orgRes.status === 404) {
        throw new Error(
          orgRes.status === 401 ? t("sessionExpired") : (orgData.error ?? t("createOrgFailed"))
        );
      }
      if (!orgRes.ok) {
        throw new Error(orgData.error ?? t("createOrgFailed"));
      }

      setStep("passkey");
      const wallet = await resolveMemberWallet();
      const memberC = wallet.contractId;
      const credId = wallet.credentialId;
      setMemberContractId(memberC);

      setStep("register");
      await registerSmartAccount({
        type: "member",
        contractId: memberC,
        credentialId: credId,
        publicKey: wallet.publicKey,
        label: fullName.trim(),
      });

      setStep("treasury");
      const treasuryRes = await fetch("/api/profile/org/provision-treasury", {
        method: "POST",
        credentials: "include",
      });
      const treasuryData = await treasuryRes.json().catch(() => ({}));
      if (!treasuryRes.ok) {
        throw new Error(treasuryData.error ?? t("treasuryFailed"));
      }

      const treasuryId = treasuryData.soroban_contract_id ?? null;
      setTreasuryContractId(treasuryId);

      setStep("sozuTag");
      const tagRes = await fetch("/api/profile/org/sozu-tag", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username: orgTagNormalized }),
      });
      const tagData = await tagRes.json().catch(() => ({}));
      if (!tagRes.ok) {
        throw new Error(tagData.error ?? t("orgSozuTagFailed"));
      }

      const savedTag =
        typeof tagData.username === "string" ? tagData.username.replace(/^\$/, "") : orgTagNormalized;
      setOrgSozuTag(savedTag);
      const receive =
        typeof tagData.tag_receive_address === "string"
          ? tagData.tag_receive_address
          : treasuryId;
      setOrgTagReceiveAddress(receive);

      setStep("done");
    } catch (e) {
      setStep("error");
      const code = e instanceof Error ? e.message : "";
      if (code === "WRONG_PASSKEY") setError(t("wrongPasskey"));
      else if (
        code === "PASSKEY_PUBLIC_KEY_MISSING" ||
        /passkey public key not found/i.test(code) ||
        /could not resolve passkey public key/i.test(code)
      ) {
        setError(t("passkeyKeyMissing"));
      } else setError(e instanceof Error ? e.message : t("somethingWentWrong"));
    }
  }

  if (step === "done") {
    function finishMerchantOnboarding(path: string) {
      clearClientSignupIntent();
      router.replace(path);
    }

    if (isMerchantIntent) {
      return (
        <DarkGradientBg>
          <main className="min-h-screen flex flex-col items-center justify-center p-4 dark text-white">
            <div className="w-full max-w-md rounded-xl border border-white/10 bg-black/40 backdrop-blur-sm p-6 shadow-xl">
              <h1 className="text-xl font-semibold text-white">{t("doneTitleMerchant")}</h1>
              <p className="mt-2 text-sm text-gray-300">{t("doneBodyMerchant")}</p>
              {orgSozuTag && (
                <div className="mt-4 rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3">
                  <p className="text-xs text-emerald-200">{t("orgSozuTagReadyMerchant")}</p>
                  <p className="mt-1 font-mono text-sm text-white">${orgSozuTag}</p>
                </div>
              )}
              <div className="mt-6 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => finishMerchantOnboarding("/dashboard")}
                  className="w-full rounded-md bg-white text-gray-900 py-2.5 px-4 font-medium hover:opacity-90 transition-opacity"
                >
                  {t("getStartedCta")}
                </button>
                <button
                  type="button"
                  onClick={() => finishMerchantOnboarding("/dashboard/profile")}
                  className="w-full rounded-md border border-white/20 bg-white/5 py-2.5 px-4 text-sm font-medium text-white hover:bg-white/10"
                >
                  {t("viewAccountCta")}
                </button>
              </div>
            </div>
          </main>
        </DarkGradientBg>
      );
    }

    return (
      <DarkGradientBg>
        <OrgFundPaymentModal
          open={fundModalOpen}
          onClose={() => setFundModalOpen(false)}
          orgSozuTag={orgSozuTag}
        />
        <main className="min-h-screen flex flex-col items-center justify-center p-4 dark text-white">
          <div className="w-full max-w-md rounded-xl border border-white/10 bg-black/40 backdrop-blur-sm p-6 shadow-xl">
            <h1 className="text-xl font-semibold text-white">{t("doneTitle")}</h1>
            <p className="mt-2 text-sm text-gray-300">{t("doneBody")}</p>
            {orgSozuTag && (
              <div className="mt-4 rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3">
                <p className="text-xs text-emerald-200">{t("orgSozuTagReady")}</p>
                <p className="mt-1 font-mono text-sm text-white">${orgSozuTag}</p>
              </div>
            )}
            <div className="mt-6 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setFundModalOpen(true)}
                className="w-full rounded-md bg-white text-gray-900 py-2.5 px-4 font-medium hover:opacity-90 transition-opacity"
              >
                {t("fundAccountCta")}
              </button>
              <button
                type="button"
                onClick={() => router.replace("/onboarding/organizations")}
                className="w-full rounded-md border border-white/20 bg-white/5 py-2.5 px-4 text-sm font-medium text-white hover:bg-white/10"
              >
                {t("goOrgPicker")}
              </button>
              <button
                type="button"
                onClick={() => router.replace("/dashboard/disbursements")}
                className="w-full rounded-md border border-white/20 bg-white/5 py-2.5 px-4 text-sm font-medium text-white hover:bg-white/10"
              >
                {t("goDisbursements")}
              </button>
            </div>
          </div>
        </main>
      </DarkGradientBg>
    );
  }

  if (isBusy) {
    const stepKey =
      step === "passkey" ||
      step === "org" ||
      step === "register" ||
      step === "treasury" ||
      step === "sozuTag"
        ? step
        : "org";
    const label = t(`steps.${stepKey}`);
    return (
      <DarkGradientBg>
        <main className="min-h-screen flex flex-col items-center justify-center p-4 dark text-white">
          <OrgCreateSetupProgress
            currentStep={stepKey}
            stepLabels={setupStepLabels}
            title={isMerchantIntent ? t("busyTitleMerchant") : t("busyTitle")}
            subtitle={label}
            hint={isMerchantIntent ? t("busyHintMerchant") : t("busyHint")}
            spinner={
              <div
                className="h-10 w-10 rounded-full border-2 border-white/20 border-t-white animate-spin"
                aria-hidden
              />
            }
          />
        </main>
      </DarkGradientBg>
    );
  }

  return (
    <DarkGradientBg>
      <main className="min-h-screen flex flex-col items-center justify-center p-4 dark text-white">
        <div className="w-full max-w-md rounded-xl border border-white/10 bg-black/40 backdrop-blur-sm p-6 shadow-xl">
          <h1 className="text-xl font-semibold text-white">
            {isMerchantIntent ? t("titleMerchant") : t("title")}
          </h1>
          <p className="mt-2 text-sm text-gray-300">
            {isMerchantIntent ? t("subtitleMerchant") : t("subtitle")}
          </p>

          {(error || kitError) && (
            <p className="mt-3 text-sm text-red-400">{error || kitError}</p>
          )}

          {!ready && (
            <p className="mt-3 text-sm text-gray-400">{t("loadingKit")}</p>
          )}

          <div className="mt-5 space-y-3">
            <p className="text-[11px] font-medium uppercase tracking-wider text-gray-500">
              {t("sectionYou")}
            </p>

            {userSozuTag ? (
              <div className="rounded-md border border-white/10 bg-black/25 px-3 py-2.5">
                <p className="text-xs font-medium text-gray-400">{t("yourSozuTagLabel")}</p>
                <p className="mt-0.5 font-mono text-sm text-white">${userSozuTag}</p>
                <p className="mt-1 text-[11px] text-gray-500">{t("yourSozuTagHint")}</p>
              </div>
            ) : null}

            <div>
              <label className="text-xs font-medium text-gray-300">{t("fullNameLabel")}</label>
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder={t("fullNamePlaceholder")}
                className="mt-1 w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-white/20"
              />
              <p className="mt-1 text-[11px] text-gray-500">{t("fullNameHint")}</p>
            </div>

            <p className="pt-2 text-[11px] font-medium uppercase tracking-wider text-gray-500">
              {isMerchantIntent ? t("sectionBusiness") : t("sectionOrganization")}
            </p>

            <div>
              <label className="text-xs font-medium text-gray-300">{t("orgNameLabel")}</label>
              <input
                value={orgName}
                onChange={(e) => handleOrgNameChange(e.target.value)}
                placeholder={isMerchantIntent ? t("orgNamePlaceholderMerchant") : t("orgNamePlaceholder")}
                className="mt-1 w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-white/20"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-gray-300">{t("orgSozuTagLabel")}</label>
              <div className="mt-1 flex items-center rounded-md border border-white/15 bg-black/30 focus-within:ring-2 focus-within:ring-white/20">
                <span className="pl-3 text-sm text-gray-500">$</span>
                <input
                  value={orgSozuTagInput.replace(/^\$+/, "")}
                  onChange={(e) => handleOrgTagChange(e.target.value)}
                  placeholder={isMerchantIntent ? t("orgSozuTagPlaceholderMerchant") : t("orgSozuTagPlaceholder")}
                  autoComplete="off"
                  spellCheck={false}
                  className="w-full bg-transparent px-2 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none"
                />
              </div>
              <p className="mt-1 text-[11px] text-gray-500">{t("orgSozuTagAutoHint")}</p>
              {orgTagChecking && orgTagNormalized ? (
                <p className="mt-1 text-[11px] text-gray-400">{t("orgSozuTagChecking")}</p>
              ) : null}
              {!orgTagChecking && orgTagCheckError ? (
                <p className="mt-1 text-[11px] text-red-400">{orgTagCheckError}</p>
              ) : null}
              {!orgTagChecking && orgTagAvailable && orgTagNormalized ? (
                <p className="mt-1 text-[11px] text-emerald-400">{t("orgSozuTagAvailable")}</p>
              ) : null}
            </div>

            <div className="rounded-md border border-white/10 bg-black/25 overflow-hidden">
              <button
                type="button"
                onClick={() => setTaxOpen((o) => !o)}
                className="w-full flex items-center justify-between px-3 py-2.5 text-left text-sm font-medium text-gray-200 hover:bg-white/5"
              >
                {t("setTaxNow")}
                <span className="text-gray-500" aria-hidden>
                  {taxOpen ? "−" : "+"}
                </span>
              </button>
              {taxOpen ? (
                <div className="space-y-3 border-t border-white/10 px-3 py-3">
                  <p className="text-[11px] text-gray-500">
                    {isMerchantIntent ? t("taxSectionHintMerchant") : t("taxSectionHint")}
                  </p>
                  {!isMerchantIntent ? (
                    <div>
                      <p className="text-xs font-medium text-gray-300">{t("taxEntityLabel")}</p>
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setTaxEntityType("private_company")}
                          className={`rounded-md border py-2.5 px-2 text-left text-xs font-medium transition-colors ${
                            taxEntityType === "private_company"
                              ? "border-white/30 bg-white/10 text-white"
                              : "border-white/15 bg-white/5 text-gray-300 hover:bg-white/10"
                          }`}
                        >
                          {t("taxEntityPrivateCompany")}
                        </button>
                        <button
                          type="button"
                          onClick={() => setTaxEntityType("ngo")}
                          className={`rounded-md border py-2.5 px-2 text-left text-xs font-medium transition-colors ${
                            taxEntityType === "ngo"
                              ? "border-white/30 bg-white/10 text-white"
                              : "border-white/15 bg-white/5 text-gray-300 hover:bg-white/10"
                          }`}
                        >
                          {t("taxEntityNgo")}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400">{t("taxEntityPrivateCompany")}</p>
                  )}
                  <div>
                    <label className="text-xs font-medium text-gray-300">{t("taxLegalNameLabel")}</label>
                    <input
                      value={taxLegalName}
                      onChange={(e) => setTaxLegalName(e.target.value)}
                      placeholder={t("taxLegalNamePlaceholder")}
                      className="mt-1 w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-white/20"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-300">{t("taxIdLabel")}</label>
                    <input
                      value={taxId}
                      onChange={(e) => setTaxId(e.target.value)}
                      placeholder={t("taxIdPlaceholder")}
                      className="mt-1 w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-white/20"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-300">{t("taxAddressLabel")}</label>
                    <input
                      value={taxAddress}
                      onChange={(e) => setTaxAddress(e.target.value)}
                      placeholder={t("taxAddressPlaceholder")}
                      className="mt-1 w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-white/20"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs font-medium text-gray-300">{t("taxCityLabel")}</label>
                      <input
                        value={taxCity}
                        onChange={(e) => setTaxCity(e.target.value)}
                        placeholder={t("taxCityLabel")}
                        aria-label={t("taxCityLabel")}
                        className="mt-1 w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-white/20"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-300">{t("taxStateLabel")}</label>
                      <input
                        value={taxState}
                        onChange={(e) => setTaxState(e.target.value)}
                        placeholder={t("taxStateLabel")}
                        aria-label={t("taxStateLabel")}
                        className="mt-1 w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-white/20"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-300">{t("taxCountryLabel")}</label>
                    <input
                      value={taxCountry}
                      onChange={(e) => setTaxCountry(e.target.value)}
                      placeholder={t("taxCountryPlaceholder")}
                      className="mt-1 w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-white/20"
                    />
                  </div>
                </div>
              ) : null}
            </div>

            <p className="pt-1 text-[11px] font-medium uppercase tracking-wider text-gray-500">
              {isMerchantIntent ? t("sectionTeamMerchant") : t("sectionMembers")}
            </p>

            <div>
              <label className="text-xs font-medium text-gray-300">{t("guardianLabel")}</label>
              <input
                type="number"
                min={1}
                max={10}
                value={guardianThreshold}
                onChange={(e) => setGuardianThreshold(parseInt(e.target.value || "2", 10))}
                title={t("guardianTitle")}
                className="mt-1 w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-white/20"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-gray-300">{t("invitesLabel")}</label>
              <textarea
                value={invitesText}
                onChange={(e) => setInvitesText(e.target.value)}
                rows={4}
                placeholder={t("invitesPlaceholder")}
                className="mt-1 w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-white/20"
              />
              <p className="mt-1 text-xs text-gray-400">{t("invitesParsed", { count: invites.length })}</p>
            </div>
          </div>

          <div className="mt-6">
            <button
              type="button"
              onClick={() => void handleCreate()}
              disabled={!canStart}
              className="w-full rounded-md bg-white text-gray-900 py-2.5 px-4 font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {step === "error" ? t("retry") : isMerchantIntent ? t("submitMerchant") : t("submit")}
            </button>
          </div>
        </div>
      </main>
    </DarkGradientBg>
  );
}
