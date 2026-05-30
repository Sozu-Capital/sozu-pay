"use client";

import { useCallback, useState } from "react";
import { usePrivyLogoutFromContext } from "@/lib/auth/sign-out-context";

/**
 * Clears app session (and Privy when wrapped), then navigates to `/?fresh=1`.
 */
export function useSignOut() {
  const privyLogout = usePrivyLogoutFromContext();
  const [signingOut, setSigningOut] = useState(false);

  const signOut = useCallback(async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      if (typeof privyLogout === "function") {
        try {
          await privyLogout();
        } catch {
          // Privy may already be logged out
        }
      }
      try {
        await fetch("/api/auth/clear-session", { method: "POST", credentials: "include" });
      } catch {
        // continue
      }
      window.location.href = "/?fresh=1";
    } catch {
      setSigningOut(false);
    }
  }, [privyLogout, signingOut]);

  return { signOut, signingOut };
}
