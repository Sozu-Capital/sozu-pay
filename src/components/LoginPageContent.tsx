"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { DarkGradientBg } from "@/components/ui/elegant-dark-pattern";
import { HomeLandingShell } from "@/components/HomeLandingShell";
import { HomePasskeyAuth } from "@/components/HomePasskeyAuth";

type LoginPageContentProps = {
  clearSessionOnMount?: boolean;
  returnTo?: string;
};

export function LoginPageContent({ clearSessionOnMount, returnTo }: LoginPageContentProps) {
  const t = useTranslations("login");
  const [cleared, setCleared] = useState(!clearSessionOnMount);
  const clearedRef = useRef(false);

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
      <DarkGradientBg landing>
        <HomeLandingShell status={<p className="text-sm text-gray-400">{t("redirecting")}</p>} />
      </DarkGradientBg>
    );
  }

  return (
    <DarkGradientBg landing>
      <HomeLandingShell
        introCta={
          <HomePasskeyAuth returnTo={returnTo} onBusyChange={() => {}} />
        }
      />
    </DarkGradientBg>
  );
}
