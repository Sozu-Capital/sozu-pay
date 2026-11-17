"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { PollarClient } from "@pollar/core";
import {
  discardReservedPollarOAuthPopup,
  getPollarBrowserClient,
  getPollarPublishableKey,
  isPollarFakeAuth,
  logoutPollarBrowserClient,
  reservePollarOAuthPopup,
  resetPollarBrowserClient,
} from "@/lib/pollar/browser-client";
import { completeHostedOAuthSession } from "@/lib/pollar/oauth-complete";
import {
  clearPendingPollarOAuth,
  persistPollarReturnTo,
  readPendingPollarOAuth,
  readPollarReturnTo,
  sanitizeReturnTo,
} from "@/lib/pollar/oauth-resume";

type HomePollarAuthProps = {
  returnTo?: string;
  onBusyChange?: (busy: boolean) => void;
};

function encodeFakeEmail(email: string): string {
  return email.replace(/@/g, "_at_");
}

function accessTokenFromClient(client: PollarClient): string | null {
  const state = client.getAuthState();
  if (state.step === "authenticated" && state.session?.token?.accessToken) {
    return state.session.token.accessToken;
  }
  return null;
}

function waitForAccessToken(client: PollarClient, fallbackMessage: string): Promise<string> {
  const existing = accessTokenFromClient(client);
  if (existing) return Promise.resolve(existing);

  return new Promise<string>((resolve, reject) => {
    const unsub = client.onAuthStateChange((state) => {
      if (state.step === "authenticated" && state.session?.token?.accessToken) {
        unsub();
        resolve(state.session.token.accessToken);
      } else if (state.step === "error") {
        unsub();
        reject(new Error(state.message || fallbackMessage));
      }
    });
    try {
      client.login({ provider: "google" });
    } catch (err) {
      unsub();
      reject(err instanceof Error ? err : new Error(fallbackMessage));
    }
  });
}

/**
 * NGO home Google-only Pollar login. On success, bridges to SozuPay session via
 * POST /api/auth/pollar/verify. No email OTP / GitHub / passkey on this door.
 */
export function HomePollarAuth({ returnTo, onBusyChange }: HomePollarAuthProps) {
  const t = useTranslations("login");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const resumeRef = useRef(false);

  const fakeAuth = isPollarFakeAuth();

  const setBusyState = useCallback(
    (v: boolean) => {
      setBusy(v);
      onBusyChange?.(v);
    },
    [onBusyChange],
  );

  const bridgeWithToken = useCallback(
    async (token: string, nextReturnTo?: string) => {
      const res = await fetch("/api/auth/pollar/verify", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          returnTo: sanitizeReturnTo(nextReturnTo) ?? sanitizeReturnTo(returnTo),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error ?? t("failedToSignIn"));
      }
      const stored = readPollarReturnTo();
      const redirect =
        sanitizeReturnTo(typeof data.redirect === "string" ? data.redirect : undefined) ??
        stored ??
        "/onboarding/organizations";
      clearPendingPollarOAuth();
      window.location.assign(redirect);
    },
    [returnTo, t],
  );

  useEffect(() => {
    if (fakeAuth || resumeRef.current) return;
    const pending = readPendingPollarOAuth();
    if (!pending) return;
    resumeRef.current = true;
    setBusyState(true);
    void (async () => {
      try {
        persistPollarReturnTo(returnTo);
        const apiKey = getPollarPublishableKey();
        let token: string | null = null;
        const existing = getPollarBrowserClient();
        if (existing) {
          await existing.ready();
          token = accessTokenFromClient(existing);
        }
        if (!token && apiKey) {
          token = await completeHostedOAuthSession({
            clientSessionId: pending.clientSessionId,
            apiKey,
          });
          if (token) resetPollarBrowserClient();
        }
        if (!token) {
          clearPendingPollarOAuth();
          throw new Error(t("failedToSignIn"));
        }
        await bridgeWithToken(token, readPollarReturnTo() ?? returnTo);
      } catch (err) {
        resumeRef.current = false;
        const message = err instanceof Error ? err.message : t("failedToSignIn");
        setError(message);
        setBusyState(false);
      }
    })();
  }, [bridgeWithToken, fakeAuth, returnTo, setBusyState, t]);

  async function handleGoogle() {
    setError("");
    persistPollarReturnTo(returnTo);
    // Reserve the OAuth window in this click tick before any await (iOS popup rule).
    if (!fakeAuth) reservePollarOAuthPopup();
    setBusyState(true);
    try {
      if (fakeAuth) {
        const subject =
          (process.env.NEXT_PUBLIC_POLLAR_FAKE_SUBJECT ?? "").trim() || `dev-${Date.now()}`;
        const email = `dev+${subject}@example.com`;
        await bridgeWithToken(`fake.${subject}.${encodeFakeEmail(email)}`);
        return;
      }

      const client = getPollarBrowserClient();
      if (!client) {
        discardReservedPollarOAuthPopup();
        throw new Error(t("pollarNotConfigured"));
      }

      await client.ready();

      const reused = accessTokenFromClient(client);
      if (reused) {
        discardReservedPollarOAuthPopup();
        try {
          await bridgeWithToken(reused);
          return;
        } catch {
          await logoutPollarBrowserClient();
        }
      }

      const fresh = getPollarBrowserClient();
      if (!fresh) {
        discardReservedPollarOAuthPopup();
        throw new Error(t("pollarNotConfigured"));
      }
      await fresh.ready();
      const token = await waitForAccessToken(fresh, t("failedToSignIn"));
      await bridgeWithToken(token);
    } catch (err) {
      discardReservedPollarOAuthPopup();
      const message = err instanceof Error ? err.message : t("failedToSignIn");
      if (message.includes("before initialization")) {
        await logoutPollarBrowserClient();
      }
      setError(message.includes("before initialization") ? t("failedToSignIn") : message);
      setBusyState(false);
    }
  }

  return (
    <div className="flex w-full max-w-sm flex-col items-stretch gap-3">
      <button
        type="button"
        onClick={() => void handleGoogle()}
        disabled={busy}
        className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full bg-white px-6 text-sm font-semibold text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <GoogleGlyph />
        {busy ? t("redirecting") : t("continueWithGoogle")}
      </button>
      {fakeAuth ? (
        <p className="text-center text-[11px] text-white/45">{t("pollarDevModeHint")}</p>
      ) : null}
      {error ? (
        <p className="text-center text-sm text-red-300" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function GoogleGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l5.7-5.7C34.2 6.1 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.5-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 16.1 19 13 24 13c3.1 0 5.8 1.1 8 3l5.7-5.7C34.2 6.1 29.4 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.3 35.3 26.8 36 24 36c-5.3 0-9.7-3.3-11.3-7.9l-6.5 5C9.6 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.5l.1.1 6.2 5.2C39.2 36.3 44 31 44 24c0-1.3-.1-2.5-.4-3.5z"
      />
    </svg>
  );
}
