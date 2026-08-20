"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { DarkGradientBg } from "@/components/ui/elegant-dark-pattern";
import { HomeLandingShell } from "@/components/HomeLandingShell";
import { HomeStaffAuth } from "@/components/HomeStaffAuth";
import { logoutPollarBrowserClient } from "@/lib/pollar/browser-client";

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
        await logoutPollarBrowserClient();
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
        <HomeLandingShell
          passkeyRegister={false}
          status={<p className="text-sm text-gray-400">{t("redirecting")}</p>}
        />
      </DarkGradientBg>
    );
  }

  return (
    <DarkGradientBg mobileLanding>
      <HomeLandingShell
        passkeyRegister={false}
        introCta={<HomeStaffAuth returnTo={returnTo} />}
        footerExtra={
          <p className="text-center text-sm text-gray-400">
            <Link href="/join" className="underline underline-offset-2 hover:text-gray-200">
              {t("haveInvite")}
            </Link>
          </p>
        }
      />
    </DarkGradientBg>
  );
}
