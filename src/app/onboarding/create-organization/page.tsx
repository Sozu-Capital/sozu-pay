"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { DarkGradientBg } from "@/components/ui/elegant-dark-pattern";
import { useSmartAccountKitContext } from "@/components/SmartAccountKitProvider";
import { checkUsernameAvailable } from "@/lib/auth/passkey-client";
import { registerSmartAccount } from "@/lib/stellar/smartAccounts/registerWalletClient";

type OrgType = "store" | "ngo";
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
  const { ready, kit, linkMemberWallet, error: kitError } = useSmartAccountKitContext();

  const [type, setType] = useState<OrgType>("ngo");
  const [orgName, setOrgName] = useState("");
  const [orgSozuTagInput, setOrgSozuTagInput] = useState("");
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
    setOrgName((prev) => prev || t("defaultOrgName"));
  }, [t]);

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
          type,
          name: orgName,
          guardianThreshold,
          invites,
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
      const wallet = await linkMemberWallet(loginCredentialId ?? undefined);
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
      else if (code === "PASSKEY_PUBLIC_KEY_MISSING") setError(t("passkeyKeyMissing"));
      else setError(e instanceof Error ? e.message : t("somethingWentWrong"));
    }
  }

  if (step === "done") {
    return (
      <DarkGradientBg>
        <main className="min-h-screen flex flex-col items-center justify-center p-4 dark text-white">
          <div className="w-full max-w-md rounded-xl border border-white/10 bg-black/40 backdrop-blur-sm p-6 shadow-xl">
            <h1 className="text-xl font-semibold text-white">{t("doneTitle")}</h1>
            <p className="mt-2 text-sm text-gray-300">{t("doneBody")}</p>
            {orgSozuTag && (
              <div className="mt-4 rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3">
                <p className="text-xs text-emerald-200">{t("orgSozuTagReady")}</p>
                <p className="mt-1 font-mono text-sm text-white">${orgSozuTag}</p>
                <p className="mt-2 text-[11px] text-gray-400">{t("orgSozuTagFundHint")}</p>
              </div>
            )}
            {orgTagReceiveAddress && (
              <div className="mt-3 rounded-md border border-white/10 bg-black/30 p-3">
                <p className="text-xs text-gray-400">{t("fundTreasury")}</p>
                <p className="mt-1 font-mono text-xs break-all text-white">{orgTagReceiveAddress}</p>
              </div>
            )}
            {memberContractId && (
              <div className="mt-3 rounded-md border border-white/10 bg-black/30 p-3">
                <p className="text-xs text-gray-400">{t("yourPasskeyAccount")}</p>
                <p className="mt-1 font-mono text-xs break-all text-white">{memberContractId}</p>
              </div>
            )}
            <div className="mt-6 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => router.replace("/onboarding/organizations")}
                className="w-full rounded-md bg-white text-gray-900 py-2.5 px-4 font-medium hover:opacity-90 transition-opacity"
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
    const stepKey = step as "passkey" | "org" | "register" | "treasury" | "sozuTag";
    const label =
      step === "passkey" ||
      step === "org" ||
      step === "register" ||
      step === "treasury" ||
      step === "sozuTag"
        ? t(`steps.${stepKey}`)
        : t("steps.settingUp");
    return (
      <DarkGradientBg>
        <main className="min-h-screen flex flex-col items-center justify-center p-4 dark text-white">
          <div className="w-full max-w-md rounded-xl border border-white/10 bg-black/40 backdrop-blur-sm p-8 shadow-xl text-center">
            <div
              className="mx-auto h-10 w-10 rounded-full border-2 border-white/20 border-t-white animate-spin"
              aria-hidden
            />
            <h1 className="mt-6 text-lg font-semibold">{t("busyTitle")}</h1>
            <p className="mt-2 text-sm text-gray-300">{label}</p>
            <p className="mt-4 text-xs text-gray-500">{t("busyHint")}</p>
          </div>
        </main>
      </DarkGradientBg>
    );
  }

  return (
    <DarkGradientBg>
      <main className="min-h-screen flex flex-col items-center justify-center p-4 dark text-white">
        <div className="w-full max-w-md rounded-xl border border-white/10 bg-black/40 backdrop-blur-sm p-6 shadow-xl">
          <h1 className="text-xl font-semibold text-white">{t("title")}</h1>
          <p className="mt-2 text-sm text-gray-300">{t("subtitle")}</p>

          {(error || kitError) && (
            <p className="mt-3 text-sm text-red-400">{error || kitError}</p>
          )}

          {!ready && (
            <p className="mt-3 text-sm text-gray-400">{t("loadingKit")}</p>
          )}

          <div className="mt-5 space-y-3">
            {userSozuTag ? (
              <div className="rounded-md border border-white/10 bg-black/25 px-3 py-2.5">
                <p className="text-xs font-medium text-gray-400">{t("yourSozuTagLabel")}</p>
                <p className="mt-0.5 font-mono text-sm text-white">${userSozuTag}</p>
                <p className="mt-1 text-[11px] text-gray-500">{t("yourSozuTagHint")}</p>
              </div>
            ) : null}

            <div>
              <label className="text-xs font-medium text-gray-300">{t("orgSozuTagLabel")}</label>
              <div className="mt-1 flex items-center rounded-md border border-white/15 bg-black/30 focus-within:ring-2 focus-within:ring-white/20">
                <span className="pl-3 text-sm text-gray-500">$</span>
                <input
                  value={orgSozuTagInput.replace(/^\$+/, "")}
                  onChange={(e) => setOrgSozuTagInput(e.target.value)}
                  placeholder={t("orgSozuTagPlaceholder")}
                  autoComplete="off"
                  spellCheck={false}
                  className="w-full bg-transparent px-2 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none"
                />
              </div>
              <p className="mt-1 text-[11px] text-gray-500">{t("orgSozuTagHint")}</p>
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

            <div>
              <label className="text-xs font-medium text-gray-300">{t("orgNameLabel")}</label>
              <input
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                placeholder={t("orgNamePlaceholder")}
                disabled={false}
                className="mt-1 w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-white/20"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setType("store")}
                className={`w-full rounded-md border py-3 px-3 text-left font-medium transition-colors ${
                  type === "store"
                    ? "border-white/30 bg-white/10 text-white"
                    : "border-white/15 bg-white/5 text-gray-200 hover:bg-white/10"
                }`}
              >
                {t("typeStore")}
              </button>
              <button
                type="button"
                onClick={() => setType("ngo")}
                className={`w-full rounded-md border py-3 px-3 text-left font-medium transition-colors ${
                  type === "ngo"
                    ? "border-white/30 bg-white/10 text-white"
                    : "border-white/15 bg-white/5 text-gray-200 hover:bg-white/10"
                }`}
              >
                {t("typeNgo")}
              </button>
            </div>

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
              {step === "error" ? t("retry") : t("submit")}
            </button>
          </div>
        </div>
      </main>
    </DarkGradientBg>
  );
}
