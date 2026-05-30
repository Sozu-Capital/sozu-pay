"use client";

import { useCallback, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";

/**
 * Clears Privy auth, app session cookie, and navigates to home (`/?fresh=1`).
 * Use this instead of POST /api/auth/logout forms so Privy is logged out before redirect.
 */
export function useSignOut() {
  const { logout: privyLogout } = usePrivy();
  const [signingOut, setSigningOut] = useState(false);

  const signOut = useCallback(async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      try {
        if (typeof privyLogout === "function") await privyLogout();
      } catch {
        // Privy may already be logged out
      }
      try {
        await fetch("/api/auth/clear-session", { method: "POST", credentials: "include" });
      } catch {
        // continue to login even if clear-session fails
      }
      window.location.href = "/?fresh=1";
    } catch {
      setSigningOut(false);
    }
  }, [privyLogout, signingOut]);

  return { signOut, signingOut };
}
