"use client";

import { useLayoutEffect, useState, type ReactNode } from "react";
import { PollarProvider } from "@pollar/react";
import "@pollar/react/styles.css";
import type { PollarClient } from "@pollar/core";
import { getPollarBrowserClient, isPollarFakeAuth } from "@/lib/pollar/browser-client";

/**
 * Mounts Pollar's confirmation / Turnkey setup modals on the same client
 * singleton Google login uses. Live (mainnet) wallets prompt the user; without
 * this, signatures fail with SDK_CONFIRMATION_UNAVAILABLE and setup never
 * finishes. useLayoutEffect so CosignModal is on the tree before login resume.
 */
export function PollarAppProvider({ children }: { children: ReactNode }) {
  const [client, setClient] = useState<PollarClient | null>(null);

  useLayoutEffect(() => {
    if (isPollarFakeAuth()) return;
    setClient(getPollarBrowserClient());
  }, []);

  if (!client) return children;
  return <PollarProvider client={client}>{children}</PollarProvider>;
}
