"use client";

import { useCallback, useState } from "react";

type SignOutOptions = {
  getLandingUrl?: () => string;
};

/** Clears app session, then navigates via `getLandingUrl` or `/?fresh=1`. */
export function useSignOut(options?: SignOutOptions) {
  const [signingOut, setSigningOut] = useState(false);
  const getLandingUrl = options?.getLandingUrl;

  const signOut = useCallback(async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      try {
        await fetch("/api/auth/clear-session", { method: "POST", credentials: "include" });
      } catch {
        // continue
      }
      window.location.href = getLandingUrl?.() ?? "/?fresh=1";
    } catch {
      setSigningOut(false);
    }
  }, [signingOut, getLandingUrl]);

  return { signOut, signingOut };
}
