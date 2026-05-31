"use client";

import { useCallback, useState } from "react";

/** Clears app session, then navigates to `/?fresh=1`. */
export function useSignOut() {
  const [signingOut, setSigningOut] = useState(false);

  const signOut = useCallback(async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      try {
        await fetch("/api/auth/clear-session", { method: "POST", credentials: "include" });
      } catch {
        // continue
      }
      window.location.href = "/?fresh=1";
    } catch {
      setSigningOut(false);
    }
  }, [signingOut]);

  return { signOut, signingOut };
}
