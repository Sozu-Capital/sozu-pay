"use client";

import { useState, useEffect, useRef, type ReactNode } from "react";

// Use Turnkey when explicitly enabled or when Turnkey org is set (this branch: Turnkey only, no Privy)
const USE_TURNKEY =
  process.env.NEXT_PUBLIC_USE_TURNKEY === "true" ||
  !!process.env.NEXT_PUBLIC_TURNKEY_ORGANIZATION_ID;

const LOAD_TIMEOUT_MS = 12_000;

type AuthProviderComponent = React.ComponentType<{ children: ReactNode }>;

/**
 * Loads Turnkey or Privy provider based on env.
 * NEXT_PUBLIC_USE_TURNKEY=true → Turnkey (Stellar passkey).
 * Otherwise → Privy when NEXT_PUBLIC_PRIVY_APP_ID is set.
 * When Turnkey is used we wait for the provider before rendering children so useTurnkey() is valid.
 */
export function LazyAuthWrapper({ children }: { children: ReactNode }) {
  const [AuthProvider, setAuthProvider] = useState<AuthProviderComponent | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [slowLoad, setSlowLoad] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setLoadError(null);
    setSlowLoad(false);
    if (USE_TURNKEY) {
      timeoutRef.current = setTimeout(() => setSlowLoad(true), LOAD_TIMEOUT_MS);
      import("@/components/TurnkeyProviderWrapper")
        .then((mod) => {
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
          }
          setAuthProvider(() => mod.TurnkeyProviderWrapper);
        })
        .catch((err) => {
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
          }
          const msg = err instanceof Error ? err.message : String(err);
          setLoadError(msg || "Failed to load auth. Check the console.");
        });
      return () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
      };
    } else {
      import("@/components/PrivyProviderWrapper")
        .then((mod) => setAuthProvider(() => mod.PrivyProviderWrapper))
        .catch((err) => {
          const msg = err instanceof Error ? err.message : String(err);
          setLoadError(msg || "Failed to load auth. Check the console.");
        });
    }
  }, []);

  if (loadError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-4 bg-gray-950 text-white">
        <p className="text-sm text-red-400 text-center max-w-md">{loadError}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="text-sm text-gray-300 underline hover:text-white"
        >
          Refresh page
        </button>
      </div>
    );
  }

  if (!AuthProvider) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-4 text-gray-500">
        <p>Loading…</p>
        {slowLoad && (
          <p className="text-xs text-gray-400 text-center max-w-sm">
            Taking longer than usual. The Turnkey auth service may be slow — try refreshing.
          </p>
        )}
        {slowLoad && (
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="text-sm text-gray-400 underline hover:text-white"
          >
            Refresh
          </button>
        )}
      </div>
    );
  }
  return <AuthProvider>{children}</AuthProvider>;
}
