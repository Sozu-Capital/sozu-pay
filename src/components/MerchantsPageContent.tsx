"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { DarkGradientBg } from "@/components/ui/elegant-dark-pattern";
import { MerchantsLandingFlow } from "@/components/MerchantsLandingFlow";
import { persistMerchantSignupIntent } from "@/lib/auth/signup-intent";

type MerchantsPageContentProps = {
  clearSessionOnMount?: boolean;
  returnTo?: string;
};

export function MerchantsPageContent({ clearSessionOnMount, returnTo }: MerchantsPageContentProps) {
  const t = useTranslations("login");
  const [cleared, setCleared] = useState(!clearSessionOnMount);
  const clearedRef = useRef(false);

  useEffect(() => {
    persistMerchantSignupIntent();
  }, []);

  useEffect(() => {
    if (!clearSessionOnMount) {
      setCleared(true);
      return;
    }
    if (clearedRef.current) return;
    clearedRef.current = true;
    (async () => {
      try {
        await fetch("/api/auth/clear-session", { method: "POST", credentials: "include" });
      } catch {
        // ignore
      }
      setCleared(true);
    })();
  }, [clearSessionOnMount]);

  if (!cleared) {
    return (
      <DarkGradientBg mobileLanding>
        <p className="pointer-events-none relative z-20 flex min-h-screen items-center justify-center text-sm text-gray-400">
          {t("redirecting")}
        </p>
      </DarkGradientBg>
    );
  }

  return (
    <DarkGradientBg mobileLanding>
      <MerchantsLandingFlow returnTo={returnTo} />
    </DarkGradientBg>
  );
}
