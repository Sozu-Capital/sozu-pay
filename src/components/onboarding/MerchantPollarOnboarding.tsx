"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { DarkGradientBg } from "@/components/ui/elegant-dark-pattern";
import { checkUsernameAvailable } from "@/lib/auth/passkey-client";
import { suggestOrgTagFromOrgName } from "@/lib/sozu-tag-suggest";
import { clearClientSignupIntent } from "@/lib/auth/signup-intent";
import {
  OrgCreateSetupProgress,
  type OrgSetupStepKey,
} from "@/components/onboarding/OrgCreateSetupProgress";

type Phase = "intro" | "form" | "wallet" | "busy" | "secure" | "secureHow" | "done" | "error";
type BusyStep = "org" | "wallet" | "sozuTag";

function normalizeOrgTagInput(raw: string): string {
  return raw.replace(/^\$+/, "").trim().toLowerCase();
}

function isValidOrgTag(tag: string): boolean {
  return /^[a-z0-9_]{3,30}$/.test(tag);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full max-w-md rounded-xl border border-white/10 bg-black/40 p-6 shadow-xl backdrop-blur-sm">
      {children}
    </div>
  );
}

function PrimaryButton({
  children,
  onClick,
  disabled,
  type = "button",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="w-full rounded-md bg-white py-2.5 px-4 font-medium text-gray-900 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </button>
  );
}

function SecondaryButton({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-md border border-white/20 bg-white/5 py-2.5 px-4 text-sm font-medium text-white hover:bg-white/10"
    >
      {children}
    </button>
  );
}

type MerchantPollarOnboardingProps = {
  onBackToPicker?: () => void;
};

export function MerchantPollarOnboarding({ onBackToPicker }: MerchantPollarOnboardingProps = {}) {
  const router = useRouter();
  const t = useTranslations("onboardingPages.createOrg");
  const tCommon = useTranslations("onboardingPages");

  const [phase, setPhase] = useState<Phase>("intro");
  const [busyStep, setBusyStep] = useState<BusyStep>("org");
  const [name, setName] = useState("");
  const [orgSozuTagInput, setOrgSozuTagInput] = useState("");
  const orgTagEditedRef = useRef(false);
  const [orgTagAvailable, setOrgTagAvailable] = useState<boolean | null>(null);
  const [orgTagCheckError, setOrgTagCheckError] = useState("");
  const [orgTagChecking, setOrgTagChecking] = useState(false);
  const [error, setError] = useState("");
  const [savedTag, setSavedTag] = useState<string | null>(null);
  const [savedName, setSavedName] = useState("");

  const orgTagNormalized = useMemo(
    () => normalizeOrgTagInput(orgSozuTagInput),
    [orgSozuTagInput],
  );

  useEffect(() => {
    const defaultName = t("defaultOrgNameMerchant");
    setName((prev) => {
      const next = prev || defaultName;
      if (!orgTagEditedRef.current) {
        setOrgSozuTagInput(suggestOrgTagFromOrgName(next));
      }
      return next;
    });
  }, [t]);

  function handleNameChange(value: string) {
    setName(value);
    if (!orgTagEditedRef.current) {
      setOrgSozuTagInput(suggestOrgTagFromOrgName(value));
    }
  }

  function handleOrgTagChange(value: string) {
    orgTagEditedRef.current = true;
    setOrgSozuTagInput(value);
  }

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

  const orgTagReady =
    isValidOrgTag(orgTagNormalized) && orgTagAvailable === true && !orgTagChecking;
  const canContinueFromForm = name.trim().length > 0 && orgTagReady;

  const stepOrder: OrgSetupStepKey[] = ["org", "wallet", "sozuTag"];
  const stepLabels: Partial<Record<OrgSetupStepKey, string>> = {
    org: t("stepsShort.store"),
    wallet: t("stepsShort.wallet"),
    sozuTag: t("stepsShort.sozuTag"),
  };

  async function createStoreAndWallet() {
    setError("");
    setPhase("busy");
    setBusyStep("org");
    try {
      const res = await fetch("/api/profile/org", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          type: "store",
          sozuTag: orgTagNormalized,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error ?? t("createFailed"));
      }

      setBusyStep("wallet");
      await sleep(900);

      setBusyStep("sozuTag");
      await sleep(700);

      const tagFromServer =
        typeof data.sozu_tag?.username === "string"
          ? data.sozu_tag.username.replace(/^\$/, "")
          : orgTagNormalized;
      setSavedTag(tagFromServer);
      setSavedName(name.trim());
      setPhase("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : tCommon("somethingWentWrong"));
      setPhase("error");
    }
  }

  function finish(path: string) {
    clearClientSignupIntent();
    router.replace(path);
  }

  function goBack() {
    if (phase === "busy") return;
    if (phase === "form" || phase === "error") {
      setPhase("intro");
      setError("");
      return;
    }
    if (phase === "wallet") {
      setPhase("form");
      return;
    }
    if (phase === "secureHow") {
      setPhase("secure");
      return;
    }
    if (phase === "secure") {
      setPhase("done");
      return;
    }
    if (phase === "intro") {
      if (onBackToPicker) {
        onBackToPicker();
        return;
      }
      router.replace("/");
      return;
    }
    if (phase === "done") {
      finish("/dashboard");
    }
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      e.preventDefault();
      goBack();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase]);

  return (
    <DarkGradientBg>
      <main className="relative flex min-h-screen flex-col items-center justify-center p-4 text-white">
        {phase !== "busy" ? (
          <button
            type="button"
            onClick={goBack}
            className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/80 hover:bg-white/10 hover:text-white"
            aria-label={t("closeAria")}
            title={t("closeAria")}
          >
            <span aria-hidden className="text-lg leading-none">
              ×
            </span>
          </button>
        ) : null}
        {phase === "intro" ? (
          <Card>
            <p className="text-[11px] font-medium uppercase tracking-wider text-gray-500">
              {t("merchantIntroKicker")}
            </p>
            <h1 className="mt-2 text-xl font-semibold">{t("merchantIntroTitle")}</h1>
            <p className="mt-3 text-sm leading-relaxed text-gray-300">{t("merchantIntroBody")}</p>

            <ol className="mt-6 space-y-4">
              <li className="rounded-md border border-white/10 bg-black/25 px-3 py-3">
                <p className="text-sm font-medium text-white">{t("merchantHowPosTitle")}</p>
                <p className="mt-1 text-xs leading-relaxed text-gray-400">{t("merchantHowPosBody")}</p>
              </li>
              <li className="rounded-md border border-white/10 bg-black/25 px-3 py-3">
                <p className="text-sm font-medium text-white">{t("merchantHowLinkTitle")}</p>
                <p className="mt-1 text-xs leading-relaxed text-gray-400">{t("merchantHowLinkBody")}</p>
              </li>
              <li className="rounded-md border border-white/10 bg-black/25 px-3 py-3">
                <p className="text-sm font-medium text-white">{t("merchantHowWalletTitle")}</p>
                <p className="mt-1 text-xs leading-relaxed text-gray-400">{t("merchantHowWalletBody")}</p>
              </li>
            </ol>

            <div className="mt-6">
              <PrimaryButton onClick={() => setPhase("form")}>
                {t("merchantIntroCta")}
              </PrimaryButton>
            </div>
          </Card>
        ) : null}

        {phase === "form" || phase === "error" ? (
          <Card>
            <h1 className="text-xl font-semibold">{t("pollarTitleMerchant")}</h1>
            <p className="mt-2 text-sm text-gray-300">{t("pollarSubtitleMerchant")}</p>

            {error ? (
              <p className="mt-3 text-sm text-red-400" role="alert">
                {error}
              </p>
            ) : null}

            <label className="mt-6 block text-xs font-medium text-gray-300" htmlFor="store-name">
              {t("orgNameLabelMerchant")}
            </label>
            <input
              id="store-name"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              className="mt-1 w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-gray-500 outline-none focus:ring-2 focus:ring-white/20"
              placeholder={t("orgNamePlaceholderMerchant")}
              autoComplete="organization"
            />

            <label className="mt-4 block text-xs font-medium text-gray-300" htmlFor="store-tag">
              {t("orgSozuTagLabelMerchant")}
            </label>
            <div className="mt-1 flex items-center rounded-md border border-white/15 bg-black/30 focus-within:ring-2 focus-within:ring-white/20">
              <span className="pl-3 text-sm text-gray-500">$</span>
              <input
                id="store-tag"
                value={orgSozuTagInput.replace(/^\$+/, "")}
                onChange={(e) => handleOrgTagChange(e.target.value)}
                placeholder={t("orgSozuTagPlaceholderMerchant")}
                autoComplete="off"
                spellCheck={false}
                className="w-full bg-transparent px-2 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none"
              />
            </div>
            <p className="mt-1 text-[11px] text-gray-500">{t("orgSozuTagHintMerchant")}</p>
            {orgTagChecking && orgTagNormalized ? (
              <p className="mt-1 text-[11px] text-gray-400">{t("orgSozuTagChecking")}</p>
            ) : null}
            {!orgTagChecking && orgTagCheckError ? (
              <p className="mt-1 text-[11px] text-red-400">{orgTagCheckError}</p>
            ) : null}
            {!orgTagChecking && orgTagAvailable && orgTagNormalized ? (
              <p className="mt-1 text-[11px] text-emerald-400">{t("orgSozuTagAvailable")}</p>
            ) : null}

            <div className="mt-6 flex flex-col gap-2">
              <PrimaryButton
                onClick={() => {
                  setError("");
                  setPhase("wallet");
                }}
                disabled={!canContinueFromForm}
              >
                {phase === "error" ? t("retry") : t("merchantFormCta")}
              </PrimaryButton>
              <SecondaryButton onClick={() => setPhase("intro")}>
                {t("merchantBack")}
              </SecondaryButton>
            </div>
          </Card>
        ) : null}

        {phase === "wallet" ? (
          <Card>
            <p className="text-[11px] font-medium uppercase tracking-wider text-gray-500">
              {t("merchantWalletKicker")}
            </p>
            <h1 className="mt-2 text-xl font-semibold">{t("merchantWalletTitle")}</h1>
            <p className="mt-3 text-sm leading-relaxed text-gray-300">{t("merchantWalletBody")}</p>
            <ul className="mt-5 space-y-2 text-sm text-gray-300">
              <li className="flex gap-2">
                <span className="text-emerald-400" aria-hidden>
                  ✓
                </span>
                <span>{t("merchantWalletPoint1")}</span>
              </li>
              <li className="flex gap-2">
                <span className="text-emerald-400" aria-hidden>
                  ✓
                </span>
                <span>{t("merchantWalletPoint2")}</span>
              </li>
              <li className="flex gap-2">
                <span className="text-emerald-400" aria-hidden>
                  ✓
                </span>
                <span>{t("merchantWalletPoint3")}</span>
              </li>
            </ul>
            <p className="mt-4 text-xs text-gray-500">{t("merchantWalletHint")}</p>
            <div className="mt-6 flex flex-col gap-2">
              <PrimaryButton onClick={() => void createStoreAndWallet()}>
                {t("merchantWalletCta")}
              </PrimaryButton>
              <SecondaryButton onClick={() => setPhase("form")}>
                {t("merchantBack")}
              </SecondaryButton>
            </div>
          </Card>
        ) : null}

        {phase === "busy" ? (
          <OrgCreateSetupProgress
            currentStep={busyStep}
            stepOrder={stepOrder}
            stepLabels={stepLabels}
            title={t("busyTitleMerchantPollar")}
            subtitle={t(`steps.pollar.${busyStep}`)}
            hint={t("busyHintMerchantPollar")}
            spinner={
              <div
                className="h-10 w-10 rounded-full border-2 border-white/20 border-t-white animate-spin"
                aria-hidden
              />
            }
          />
        ) : null}

        {phase === "secure" ? (
          <Card>
            <p className="text-[11px] font-medium uppercase tracking-wider text-gray-500">
              {t("secureKicker")}
            </p>
            <h1 className="mt-2 text-xl font-semibold">{t("secureTitle")}</h1>
            <p className="mt-3 text-sm leading-relaxed text-gray-300">{t("secureBody")}</p>
            <ul className="mt-5 space-y-3">
              <li className="rounded-md border border-white/10 bg-black/25 px-3 py-3">
                <p className="text-sm font-medium text-white">{t("securePoint1Title")}</p>
                <p className="mt-1 text-xs leading-relaxed text-gray-400">{t("securePoint1Body")}</p>
              </li>
              <li className="rounded-md border border-white/10 bg-black/25 px-3 py-3">
                <p className="text-sm font-medium text-white">{t("securePoint2Title")}</p>
                <p className="mt-1 text-xs leading-relaxed text-gray-400">{t("securePoint2Body")}</p>
              </li>
              <li className="rounded-md border border-white/10 bg-black/25 px-3 py-3">
                <p className="text-sm font-medium text-white">{t("securePoint3Title")}</p>
                <p className="mt-1 text-xs leading-relaxed text-gray-400">{t("securePoint3Body")}</p>
              </li>
            </ul>
            <div className="mt-6">
              <PrimaryButton onClick={() => setPhase("secureHow")}>
                {t("secureContinue")}
              </PrimaryButton>
            </div>
          </Card>
        ) : null}

        {phase === "secureHow" ? (
          <Card>
            <p className="text-[11px] font-medium uppercase tracking-wider text-gray-500">
              {t("secureHowKicker")}
            </p>
            <h1 className="mt-2 text-xl font-semibold">{t("secureHowTitle")}</h1>
            <p className="mt-3 text-sm leading-relaxed text-gray-300">{t("secureHowBody")}</p>
            <div className="mt-5 rounded-md border border-white/10 bg-black/25 px-3 py-3">
              <p className="text-xs leading-relaxed text-gray-400">{t("secureHowHint")}</p>
            </div>
            <div className="mt-6 flex flex-col gap-2">
              <PrimaryButton onClick={() => finish("/dashboard")}>
                {t("secureNowCta")}
              </PrimaryButton>
              <SecondaryButton onClick={() => setPhase("done")}>
                {t("secureLaterCta")}
              </SecondaryButton>
              <button
                type="button"
                onClick={() => setPhase("secure")}
                className="w-full py-1 text-center text-xs text-gray-500 hover:text-gray-300"
              >
                {t("merchantBack")}
              </button>
            </div>
          </Card>
        ) : null}

        {phase === "done" ? (
          <Card>
            <h1 className="text-xl font-semibold">{t("doneTitleMerchantPollar")}</h1>
            <p className="mt-2 text-sm leading-relaxed text-gray-300">
              {t("doneBodyMerchantPollar", { name: savedName || name })}
            </p>
            {savedTag ? (
              <div className="mt-4 rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3">
                <p className="text-xs text-emerald-200">{t("orgSozuTagReadyMerchant")}</p>
                <p className="mt-1 font-mono text-sm text-white">${savedTag}</p>
              </div>
            ) : null}
            <div className="mt-5 space-y-2 text-sm text-gray-300">
              <p className="text-xs font-medium uppercase tracking-wider text-gray-500">
                {t("doneHowTitle")}
              </p>
              <p>{t("doneHow1")}</p>
              <p>{t("doneHow2")}</p>
              <p>{t("doneHow3")}</p>
              <p className="text-xs text-gray-500">{t("doneHowSecure")}</p>
            </div>
            <div className="mt-6 flex flex-col gap-2">
              <PrimaryButton onClick={() => finish("/dashboard/pos")}>
                {t("openPosCta")}
              </PrimaryButton>
              <SecondaryButton onClick={() => finish("/dashboard")}>
                {t("getStartedCta")}
              </SecondaryButton>
            </div>
          </Card>
        ) : null}

        {phase === "intro" || phase === "form" || phase === "error" ? (
          <p className="mt-4 text-center text-xs text-gray-400">
            <Link href="/join" className="underline underline-offset-2 hover:text-gray-200">
              {t("haveInviteSecondary")}
            </Link>
          </p>
        ) : null}
      </main>
    </DarkGradientBg>
  );
}
