"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { usePrivy, useLogin } from "@privy-io/react-auth";
import { useTranslations } from "next-intl";
import { DarkGradientBg } from "@/components/ui/elegant-dark-pattern";
import { HomeSplineBackground } from "@/components/HomeSplineBackground";
import { HomeLandingNav } from "@/components/HomeLandingNav";
import { HomePageIntro } from "@/components/HomePageIntro";
import { HomeLandingCta } from "@/components/HomeLandingCta";
import { HomeLandingFooter } from "@/components/HomeLandingFooter";

type LoginPageContentProps = {
  /** When true (e.g. `/?fresh=1` after logout), clear app session + Privy on mount. */
  clearSessionOnMount?: boolean;
  /** After successful login, redirect here instead of default onboarding. */
  returnTo?: string;
};

function HomeLandingShell({
  introCta,
  status,
  footerExtra,
}: {
  introCta?: ReactNode;
  status?: ReactNode;
  footerExtra?: ReactNode;
}) {
  return (
    <div className="relative isolate flex min-h-[100dvh] min-h-screen flex-col overflow-hidden font-manrope">
      <HomeSplineBackground />
      <div className="pointer-events-none relative z-20 flex min-h-[100dvh] min-h-screen flex-1 flex-col [&_*]:pointer-events-none">
        <HomeLandingNav />
        <div className="pointer-events-none flex flex-1 flex-col justify-center px-6 md:px-10 lg:px-12 lg:pb-8">
          <HomePageIntro cta={introCta} status={status} />
        </div>
        <HomeLandingFooter>{footerExtra}</HomeLandingFooter>
      </div>
    </div>
  );
}

export function LoginPageContent({
  clearSessionOnMount = false,
  returnTo,
}: LoginPageContentProps) {
  const router = useRouter();
  const { ready, authenticated, user, getAccessToken, logout: privyLogout } = usePrivy();
  const { login: openLoginModal } = useLogin();
  const t = useTranslations("login");

  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");
  const [clearing, setClearing] = useState(clearSessionOnMount);
  const clearedRef = useRef(false);

  useEffect(() => {
    if (!clearSessionOnMount) {
      setClearing(false);
      return;
    }
    if (!ready) return;
    if (clearedRef.current) return;
    clearedRef.current = true;
    (async () => {
      try {
        await fetch("/api/auth/clear-session", { credentials: "include" });
      } catch {
        // ignore
      }
      try {
        if (typeof privyLogout === "function") await privyLogout();
      } catch {
        // ignore
      }
      setClearing(false);
    })();
  }, [ready, privyLogout, clearSessionOnMount]);

  useEffect(() => {
    if (clearSessionOnMount && clearing) return;
    if (!ready || !authenticated || !user) return;

    const ABORT_MS = 20_000;
    let cancelled = false;

    (async () => {
      setSyncing(true);
      setError("");
      try {
        const tokenPromise = getAccessToken();
        const timeoutPromise = new Promise<null>((_, reject) =>
          setTimeout(() => reject(new Error("Token request timed out")), ABORT_MS)
        );
        const accessToken = await Promise.race([tokenPromise, timeoutPromise]);
        if (!accessToken || cancelled) return;

        const emailAddress =
          user.email?.address ??
          (user.linkedAccounts?.find((a: { type: string }) => a.type === "email") as { address?: string } | undefined)
            ?.address;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), ABORT_MS);

        const res = await fetch("/api/auth/privy", {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ email: emailAddress ?? "" }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        if (cancelled) return;

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          setError(data.error ?? t("failedToSignIn"));
          return;
        }

        let next =
          returnTo && returnTo.startsWith("/")
            ? returnTo
            : typeof data.redirect === "string" && data.redirect.startsWith("/")
              ? data.redirect
              : null;

        if (!next) {
          const profileRes = await fetch("/api/profile", { credentials: "include" });
          const profile = await profileRes.json().catch(() => ({}));
          if (profile.needsOrgCreation) {
            next = "/onboarding/create-organization";
          } else if (profile.needsOrganization) {
            next = "/onboarding/organizations";
          } else if (profile.needsSmartWalletSetup) {
            next = "/onboarding/setup-smart-wallet";
          } else {
            next = "/dashboard";
          }
        }

        router.replace(next);
      } catch (e) {
        if (cancelled) return;
        if (e instanceof Error) {
          if (e.name === "AbortError") {
            setError(t("requestTimedOut"));
          } else {
            setError(e.message || t("somethingWentWrong"));
          }
        } else {
          setError(t("somethingWentWrong"));
        }
      } finally {
        if (!cancelled) setSyncing(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ready, authenticated, user, getAccessToken, router, t, returnTo, clearSessionOnMount, clearing]);

  const usePrivyAuth = !!process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  const isClearingSession = clearing && authenticated;

  const statusBlock = (
    <>
      {syncing && <p className="text-sm font-light tracking-wide text-gray-300">{t("redirecting")}</p>}
      {error && <p className="text-sm text-red-400/90">{error}</p>}
    </>
  );

  const signInCta = usePrivyAuth && (!authenticated || isClearingSession) && !syncing && (
    <HomeLandingCta onClick={() => ready && openLoginModal()} disabled={!ready}>
      {t("homeCta")}
    </HomeLandingCta>
  );

  if (usePrivyAuth && authenticated && !isClearingSession) {
    return (
      <DarkGradientBg landing>
        <HomeLandingShell status={statusBlock} />
      </DarkGradientBg>
    );
  }

  if (usePrivyAuth) {
    return (
      <DarkGradientBg landing>
        <HomeLandingShell introCta={signInCta} status={statusBlock || undefined} />
      </DarkGradientBg>
    );
  }

  return (
    <DarkGradientBg landing>
      <HomeLandingShell
        status={<p className="text-sm font-light text-gray-400">{t("privyNotConfigured")}</p>}
      />
    </DarkGradientBg>
  );
}
