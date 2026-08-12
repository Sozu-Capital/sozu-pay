"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { HomeLandingTransitionProvider } from "@/components/HomeLandingTransition";
import { HomeSplineBackground } from "@/components/HomeSplineBackground";
import { HomePageIntro } from "@/components/HomePageIntro";
import { HomeLandingFooter } from "@/components/HomeLandingFooter";
import { ScfCommunityFundToast } from "@/components/ScfCommunityFundToast";
import { HomePollarAuth } from "@/components/HomePollarAuth";
import { HomeLandingCta } from "@/components/HomeLandingCta";
import { MerchantsBetaScreen } from "@/components/MerchantsBetaScreen";
import {
  MerchantsLandingNav,
  type MerchantsLandingStep,
} from "@/components/MerchantsLandingNav";

type MerchantsLandingFlowProps = {
  returnTo?: string;
};

function MerchantsLandingInner({ returnTo }: MerchantsLandingFlowProps) {
  const t = useTranslations("login");
  const [step, setStep] = useState<MerchantsLandingStep>("hero");

  function openLogin() {
    setStep("auth");
  }

  function openBetaSignup() {
    setStep("beta");
  }

  function acknowledgeBeta() {
    setStep("auth");
  }

  return (
    <div className="relative isolate flex min-h-[100dvh] min-h-screen flex-col overflow-hidden font-manrope">
      <HomeSplineBackground />
      {step === "beta" ? (
        <div
          className="pointer-events-none fixed inset-0 z-[6] bg-black/55 backdrop-blur-2xl md:absolute"
          aria-hidden
        />
      ) : null}
      <div className="pointer-events-none relative z-20 flex min-h-[100dvh] min-h-screen flex-1 flex-col">
        <MerchantsLandingNav step={step} onCreateAccountFromHero={openBetaSignup} />
        <div className="flex flex-1 flex-col justify-center px-6 md:px-10 lg:px-12 lg:pb-8">
          {step === "hero" && (
            <HomePageIntro
              namespace="merchants"
              cta={<HomeLandingCta onClick={openLogin}>{t("homeCta")}</HomeLandingCta>}
            />
          )}
          {step === "beta" && <MerchantsBetaScreen onAcknowledge={acknowledgeBeta} />}
          {step === "auth" && (
            <div className="pointer-events-auto flex w-full max-w-sm flex-col gap-4">
              <p className="text-sm font-light text-gray-300">{t("merchantAuthLead")}</p>
              <HomePollarAuth returnTo={returnTo} onBusyChange={() => {}} />
            </div>
          )}
        </div>
        <HomeLandingFooter />
      </div>
      <ScfCommunityFundToast visible={step !== "beta"} />
    </div>
  );
}

export function MerchantsLandingFlow({ returnTo }: MerchantsLandingFlowProps) {
  return (
    <HomeLandingTransitionProvider>
      <MerchantsLandingInner returnTo={returnTo} />
    </HomeLandingTransitionProvider>
  );
}
