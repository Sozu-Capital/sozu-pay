"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { SozuLoadingMark } from "@/components/SozuLoadingMark";
import { DarkGradientBg } from "@/components/ui/elegant-dark-pattern";
import {
  getPollarBrowserClient,
  getPollarPublishableKey,
  resetPollarBrowserClient,
} from "@/lib/pollar/browser-client";
import { completeHostedOAuthSession } from "@/lib/pollar/oauth-complete";
import {
  clearPendingPollarOAuth,
  clientSessionIdFromCallbackSearch,
  readPendingPollarOAuth,
  readPollarReturnTo,
  sanitizeReturnTo,
} from "@/lib/pollar/oauth-resume";

/**
 * Pollar hosted Google OAuth returns here on mobile (same-window) so we can
 * finish the session and send the user to returnTo (including /join/:token).
 */
export default function PollarOAuthCallbackPage() {
  const t = useTranslations("login");
  const [error, setError] = useState("");
  const [showContinue, setShowContinue] = useState(false);
  const ran = useRef(false);

  useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted && !ran.current) {
        window.location.replace(window.location.href);
      }
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => setShowContinue(true), 4000);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    void (async () => {
      try {
        const returnTo = readPollarReturnTo();
        const fallback = returnTo ?? "/onboarding/organizations";

        const sendHome = (path: string) => {
          clearPendingPollarOAuth();
          window.location.replace(path);
        };

        const sessionAlreadyThere = async () => {
          const res = await fetch("/api/auth/session", { credentials: "include" });
          const body = (await res.json().catch(() => null)) as { user?: unknown } | null;
          return !!body?.user;
        };

        const fromUrl = clientSessionIdFromCallbackSearch(window.location.search);
        const pending = readPendingPollarOAuth();
        const clientSessionId = fromUrl ?? pending?.clientSessionId ?? null;
        const apiKey = getPollarPublishableKey();
        let token: string | null = null;

        const client = getPollarBrowserClient();
        if (client) {
          await Promise.race([
            client.ready(),
            new Promise((resolve) => setTimeout(resolve, 4000)),
          ]);
          const state = client.getAuthState();
          if (state.step === "authenticated") {
            token = state.session?.token?.accessToken ?? null;
          }
        }

        if (!token && clientSessionId && apiKey) {
          token = await completeHostedOAuthSession({
            clientSessionId,
            apiKey,
          });
          if (token) resetPollarBrowserClient();
        }

        if (!token) {
          if (await sessionAlreadyThere()) {
            sendHome(fallback);
            return;
          }
          clearPendingPollarOAuth();
          window.location.replace(returnTo ?? "/");
          return;
        }

        const res = await fetch("/api/auth/pollar/verify", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, returnTo }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          if (await sessionAlreadyThere()) {
            sendHome(fallback);
            return;
          }
          throw new Error(typeof data.error === "string" ? data.error : t("failedToSignIn"));
        }
        const redirect =
          sanitizeReturnTo(typeof data.redirect === "string" ? data.redirect : undefined) ??
          fallback;
        sendHome(redirect);
      } catch (err) {
        setError(err instanceof Error ? err.message : t("failedToSignIn"));
      }
    })();
  }, [t]);

  return (
    <DarkGradientBg>
      <main className="flex min-h-screen flex-col items-center justify-center p-6 text-white">
        {error ? (
          <div className="max-w-sm text-center space-y-3">
            <h1 className="text-xl font-semibold text-white">{t("failedToSignIn")}</h1>
            <p className="text-sm text-red-300" role="alert">
              {error}
            </p>
            <Link href="/" className="inline-block text-sm underline underline-offset-2">
              {t("goHome")}
            </Link>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <SozuLoadingMark />
            {showContinue ? (
              <Link href="/" className="text-sm underline underline-offset-2">
                {t("googleReturnContinue")}
              </Link>
            ) : null}
          </div>
        )}
      </main>
    </DarkGradientBg>
  );
}
