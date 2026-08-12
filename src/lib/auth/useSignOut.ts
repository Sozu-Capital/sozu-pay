"use client";

import { useCallback, useState } from "react";
import { logoutPollarBrowserClient } from "@/lib/pollar/browser-client";
import { getClientSignupIntent } from "@/lib/auth/signup-intent";

type SignOutOptions = {
  getLandingUrl?: () => string;
};

function defaultLandingUrl(): string {
  return getClientSignupIntent() === "merchant" ? "/merchants?fresh=1" : "/?fresh=1";
}

/** Clears Pollar + app session, then navigates via `getLandingUrl` or the matching home. */
export function useSignOut(options?: SignOutOptions) {
  const [signingOut, setSigningOut] = useState(false);
  const getLandingUrl = options?.getLandingUrl;

  const signOut = useCallback(async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      try {
        await logoutPollarBrowserClient();
      } catch {
        // continue
      }
      try {
        await fetch("/api/auth/clear-session", { method: "POST", credentials: "include" });
      } catch {
        // continue
      }
      window.location.href = getLandingUrl?.() ?? defaultLandingUrl();
    } catch {
      setSigningOut(false);
    }
  }, [signingOut, getLandingUrl]);

  return { signOut, signingOut };
}
