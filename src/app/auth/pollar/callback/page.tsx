"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { DarkGradientBg } from "@/components/ui/elegant-dark-pattern";
import {
  getPollarBrowserClient,
  getPollarPublishableKey,
  resetPollarBrowserClient,
} from "@/lib/pollar/browser-client";
import { completeHostedOAuthSession } from "@/lib/pollar/oauth-complete";
import {
  clearPendingPollarOAuth,
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
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    void (async () => {
      try {
        if (window.opener && !window.opener.closed) {
          window.close();
          return;
        }

        const pending = readPendingPollarOAuth();
        const apiKey = getPollarPublishableKey();
        let token: string | null = null;

        const client = getPollarBrowserClient();
        if (client) {
          await client.ready();
          const state = client.getAuthState();
          if (state.step === "authenticated") {
            token = state.session?.token?.accessToken ?? null;
          }
        }

        if (!token && pending && apiKey) {
          token = await completeHostedOAuthSession({
            clientSessionId: pending.clientSessionId,
            apiKey,
          });
          if (token) resetPollarBrowserClient();
        }

        if (!token) {
          clearPendingPollarOAuth();
          try {
            window.close();
          } catch {
            // ignore
          }
          window.location.replace(readPollarReturnTo() ?? "/");
          return;
        }

        const returnTo = readPollarReturnTo();
        const res = await fetch("/api/auth/pollar/verify", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, returnTo }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(typeof data.error === "string" ? data.error : t("failedToSignIn"));
        }
        clearPendingPollarOAuth();
        const redirect =
          sanitizeReturnTo(typeof data.redirect === "string" ? data.redirect : undefined) ??
          returnTo ??
          "/onboarding/organizations";
        window.location.replace(redirect);
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
          <p className="text-sm text-white/80">{t("redirecting")}</p>
        )}
      </main>
    </DarkGradientBg>
  );
}
