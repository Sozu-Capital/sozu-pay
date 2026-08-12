"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { DarkGradientBg } from "@/components/ui/elegant-dark-pattern";
import { getClientSignupIntent } from "@/lib/auth/signup-intent";
import { MerchantPollarOnboarding } from "@/components/onboarding/MerchantPollarOnboarding";
import {
  OrgCreateSetupProgress,
  type OrgSetupStepKey,
} from "@/components/onboarding/OrgCreateSetupProgress";

/**
 * Pollar create-org:
 * - Merchant intent → educational onboarding + store wallet progress (no passkey smart wallet).
 * - NGO → name-only; Org treasury wallet is provisioned automatically.
 */
export function PollarCreateOrganizationForm() {
  const [intent, setIntent] = useState<"loading" | "merchant" | "ngo">("loading");

  useEffect(() => {
    setIntent(getClientSignupIntent() === "merchant" ? "merchant" : "ngo");
  }, []);

  if (intent === "loading") {
    return (
      <DarkGradientBg>
        <main className="flex min-h-screen items-center justify-center p-4 text-white">
          <p className="text-sm text-gray-300">…</p>
        </main>
      </DarkGradientBg>
    );
  }

  if (intent === "merchant") {
    return <MerchantPollarOnboarding />;
  }
  return <NgoPollarCreateOrganizationForm />;
}

function NgoPollarCreateOrganizationForm() {
  const router = useRouter();
  const t = useTranslations("onboardingPages.createOrg");
  const tCommon = useTranslations("onboardingPages");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [busyStep, setBusyStep] = useState<OrgSetupStepKey>("org");
  const [error, setError] = useState("");

  const stepLabels: Partial<Record<OrgSetupStepKey, string>> = {
    org: t("stepsShort.org"),
    wallet: t("stepsShort.wallet"),
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError(t("pollarNameRequired"));
      return;
    }
    setError("");
    setBusy(true);
    setBusyStep("org");
    try {
      const res = await fetch("/api/profile/org", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed, type: "ngo" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? t("createFailed"));
        setBusy(false);
        return;
      }
      setBusyStep("wallet");
      const redirect =
        typeof data.redirect === "string" && data.redirect.startsWith("/")
          ? data.redirect
          : "/dashboard";
      router.replace(redirect);
    } catch {
      setError(tCommon("somethingWentWrong"));
      setBusy(false);
    }
  }

  if (busy) {
    return (
      <DarkGradientBg>
        <main className="flex min-h-screen flex-col items-center justify-center p-4 text-white">
          <OrgCreateSetupProgress
            currentStep={busyStep}
            stepOrder={["org", "wallet"]}
            stepLabels={stepLabels}
            title={t("busyTitle")}
            subtitle={
              busyStep === "wallet" ? t("steps.pollar.wallet") : t("steps.pollar.orgNgo")
            }
            hint={t("busyHintPollar")}
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
      <main className="flex min-h-screen flex-col items-center justify-center p-4 text-white">
        <form
          onSubmit={handleSubmit}
          className="w-full max-w-md rounded-xl border border-white/10 bg-black/40 p-6 shadow-xl backdrop-blur-sm"
        >
          <h1 className="text-xl font-semibold">{t("pollarTitle")}</h1>
          <p className="mt-2 text-sm text-gray-300">{t("pollarSubtitle")}</p>

          <label className="mt-6 block text-sm text-gray-300" htmlFor="org-name">
            {t("orgNameLabel")}
          </label>
          <input
            id="org-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-md border border-white/15 bg-black/40 px-3 py-2.5 text-white outline-none focus:border-white/40"
            placeholder={t("orgNamePlaceholder")}
            autoComplete="organization"
            disabled={busy}
          />

          {error ? <p className="mt-3 text-sm text-red-400">{error}</p> : null}

          <button
            type="submit"
            disabled={busy}
            className="mt-6 w-full rounded-md bg-white py-2.5 font-medium text-gray-900 hover:opacity-90 disabled:opacity-50"
          >
            {t("pollarCreateCta")}
          </button>

          <p className="mt-4 text-center text-xs text-gray-400">
            <Link href="/join" className="underline underline-offset-2 hover:text-gray-200">
              {t("haveInviteSecondary")}
            </Link>
          </p>
        </form>
      </main>
    </DarkGradientBg>
  );
}
