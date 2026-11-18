"use client";

import type { ReactNode } from "react";
import { PollarAppProvider } from "@/components/PollarAppProvider";
import { SmartAccountKitProvider } from "@/components/SmartAccountKitProvider";

/** Root providers: Smart Account Kit for passkey / Soroban signing. */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <SmartAccountKitProvider>
      <PollarAppProvider>{children}</PollarAppProvider>
    </SmartAccountKitProvider>
  );
}
