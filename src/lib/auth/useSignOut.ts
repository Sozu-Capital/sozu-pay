"use client";

import { useCallback, useState } from "react";
import { logoutPollarBrowserClient } from "@/lib/pollar/browser-client";

type SignOutOptions = {
  getLandingUrl?: () => string;
};

function defaultLandingUrl(): string {
  return "/?fresh=1";
}

/** Clears Pollar + app session, then navigates via `getLandingUrl` or `/`. */
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
