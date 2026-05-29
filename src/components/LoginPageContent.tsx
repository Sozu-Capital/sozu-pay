"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { usePrivy, useLogin } from "@privy-io/react-auth";
import { useTranslations } from "next-intl";
import { DarkGradientBg } from "@/components/ui/elegant-dark-pattern";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

type LoginPageContentProps = {
  /**
   * When true (e.g. /login), clear app session + Privy so the user must pick email each time.
   * When false (e.g. /), keep existing sessions so the home route is not a forced logout.
   */
  clearSessionOnMount?: boolean;
  /** After successful login, redirect here instead of default onboarding. */
  returnTo?: string;
};

export function LoginPageContent({ clearSessionOnMount = true, returnTo }: LoginPageContentProps) {
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
    // Do not re-sync Privy while we are clearing session (logout → /login race).
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

  if (usePrivyAuth && authenticated && !isClearingSession) {
    return (
      <DarkGradientBg>
        <main className="min-h-screen flex flex-col items-center justify-center gap-4 p-4 dark text-white">
          <div className="w-full max-w-sm">
            <LanguageSwitcher />
          </div>
          <Image
            src="/sozucapital_logo.png"
            alt="Sozu Capital"
            width={120}
            height={120}
            className="mb-2 object-contain"
            priority
          />
          {syncing && <p className="text-sm text-gray-300">{t("redirecting")}</p>}
          {error && <p className="text-sm text-red-400">{error}</p>}
        </main>
      </DarkGradientBg>
    );
  }

  if (usePrivyAuth) {
    return (
      <DarkGradientBg>
        <main className="min-h-screen flex flex-col items-center justify-center gap-4 p-4 dark text-white">
          <div className="w-full max-w-sm">
            <LanguageSwitcher />
          </div>
          <Image
            src="/sozucapital_logo.png"
            alt="Sozu Capital"
            width={120}
            height={120}
            className="mb-2 object-contain"
            priority
          />
          <button
            type="button"
            onClick={() => ready && openLoginModal()}
            disabled={!ready}
            className="rounded-md bg-white text-gray-900 py-2.5 px-6 font-medium hover:opacity-90 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {t("logIn")}
          </button>
        </main>
      </DarkGradientBg>
    );
  }

  return (
    <DarkGradientBg>
      <main className="min-h-screen flex flex-col items-center justify-center gap-4 p-4 dark text-white">
        <div className="w-full max-w-sm">
          <LanguageSwitcher />
        </div>
        <Image
          src="/sozucapital_logo.png"
          alt="Sozu Capital"
          width={120}
          height={120}
          className="mb-2 object-contain"
          priority
        />
        <div className="w-full max-w-sm rounded-lg border border-white/10 bg-black/40 backdrop-blur-sm p-6 shadow-lg text-center">
          <p className="text-sm text-gray-300">
            {t("privyNotConfigured")}
          </p>
          {clearSessionOnMount && (
            <Link
              href="/"
              className="mt-4 inline-block rounded-md border border-white/20 bg-white/10 py-2 px-4 text-sm font-medium text-white hover:bg-white/20"
            >
              {t("goHome")}
            </Link>
          )}
        </div>
      </main>
    </DarkGradientBg>
  );
}
