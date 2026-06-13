"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { HomeLandingTransitionProvider } from "@/components/HomeLandingTransition";
import { HomeSplineBackground } from "@/components/HomeSplineBackground";
import { HomePageIntro } from "@/components/HomePageIntro";
import { HomeLandingFooter } from "@/components/HomeLandingFooter";
import { ScfCommunityFundToast } from "@/components/ScfCommunityFundToast";
import { HomeAuthUiProvider } from "@/components/HomeAuthUiContext";
import { HomePasskeyAuth } from "@/components/HomePasskeyAuth";
import { HomeLandingCta } from "@/components/HomeLandingCta";
import { MerchantsBetaScreen } from "@/components/MerchantsBetaScreen";
import {
  MerchantsLandingNav,
  type MerchantsLandingStep,
} from "@/components/MerchantsLandingNav";
import { useHomeAuthUi } from "@/components/HomeAuthUiContext";

type AuthIntent = "login" | "register";

type MerchantsLandingFlowProps = {
  returnTo?: string;
};

function MerchantsAuthStage({
  returnTo,
  authIntent,
}: {
  returnTo?: string;
  authIntent: AuthIntent;
}) {
  const { openRegister } = useHomeAuthUi();

  useEffect(() => {
    if (authIntent === "register") {
      openRegister();
    }
  }, [authIntent, openRegister]);

  return <HomePasskeyAuth returnTo={returnTo} onBusyChange={() => {}} />;
}

function MerchantsLandingInner({ returnTo }: MerchantsLandingFlowProps) {
  const t = useTranslations("login");
  const [step, setStep] = useState<MerchantsLandingStep>("hero");
  const [authIntent, setAuthIntent] = useState<AuthIntent>("login");

  function openLogin() {
    setAuthIntent("login");
    setStep("auth");
  }

  function openBetaSignup() {
    setAuthIntent("register");
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
            <MerchantsAuthStage returnTo={returnTo} authIntent={authIntent} />
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
      <HomeAuthUiProvider>
        <MerchantsLandingInner returnTo={returnTo} />
      </HomeAuthUiProvider>
    </HomeLandingTransitionProvider>
  );
}
