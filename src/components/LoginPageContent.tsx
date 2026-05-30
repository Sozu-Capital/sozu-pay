"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { usePrivy, useLogin } from "@privy-io/react-auth";
import { useTranslations } from "next-intl";
import { isPasskeyAuth, isPrivyAuth } from "@/lib/auth/provider";
import { DarkGradientBg } from "@/components/ui/elegant-dark-pattern";
import { HomeLandingShell } from "@/components/HomeLandingShell";
import { HomeLandingCta } from "@/components/HomeLandingCta";
import { HomePasskeyAuth } from "@/components/HomePasskeyAuth";

type LoginPageContentProps = {
  clearSessionOnMount?: boolean;
  returnTo?: string;
};

function PrivyLoginContent({
  clearSessionOnMount,
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
        await fetch("/api/auth/clear-session", { method: "POST", credentials: "include" });
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
        const accessToken = await Promise.race([
          getAccessToken(),
          new Promise<null>((_, reject) =>
            setTimeout(() => reject(new Error("Token request timed out")), ABORT_MS)
          ),
        ]);
        if (!accessToken || cancelled) return;

        const emailAddress =
          user.email?.address ??
          (
            user.linkedAccounts?.find((a: { type: string }) => a.type === "email") as
              | { address?: string }
              | undefined
          )?.address;

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
          if (profile.needsOrgCreation) next = "/onboarding/create-organization";
          else if (profile.needsOrganization) next = "/onboarding/organizations";
          else if (profile.needsSmartWalletSetup) next = "/onboarding/setup-smart-wallet";
          else next = "/dashboard";
        }

        router.replace(next);
      } catch (e) {
        if (cancelled) return;
        if (e instanceof Error) {
          setError(e.name === "AbortError" ? t("requestTimedOut") : e.message || t("somethingWentWrong"));
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

  const isClearingSession = clearing && authenticated;
  const statusBlock = (
    <>
      {syncing && <p className="text-sm font-light tracking-wide text-gray-300">{t("redirecting")}</p>}
      {error && <p className="text-sm text-red-400/90">{error}</p>}
    </>
  );

  const signInCta =
    (!authenticated || isClearingSession) && !syncing ? (
      <HomeLandingCta onClick={() => ready && openLoginModal()} disabled={!ready}>
        {t("homeCta")}
      </HomeLandingCta>
    ) : null;

  if (authenticated && !isClearingSession) {
    return (
      <DarkGradientBg landing>
        <HomeLandingShell status={statusBlock} />
      </DarkGradientBg>
    );
  }

  return (
    <DarkGradientBg landing>
      <HomeLandingShell introCta={signInCta} status={statusBlock || undefined} />
    </DarkGradientBg>
  );
}

function PasskeyLoginContent({ clearSessionOnMount, returnTo }: LoginPageContentProps) {
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
          <HomePasskeyAuth
            returnTo={returnTo}
            onBusyChange={() => {}}
          />
        }
      />
    </DarkGradientBg>
  );
}

export function LoginPageContent(props: LoginPageContentProps) {
  const t = useTranslations("login");
  if (isPasskeyAuth()) {
    return <PasskeyLoginContent {...props} />;
  }
  if (isPrivyAuth()) {
    return <PrivyLoginContent {...props} />;
  }
  return (
    <DarkGradientBg landing>
      <HomeLandingShell
        status={<p className="text-sm font-light text-gray-400">{t("authNotConfigured")}</p>}
      />
    </DarkGradientBg>
  );
}
