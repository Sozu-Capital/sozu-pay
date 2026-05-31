"use client";

import type { ReactNode } from "react";
import { SmartAccountKitProvider } from "@/components/SmartAccountKitProvider";

/** Root providers: Smart Account Kit for passkey / Soroban signing. */
export function AppProviders({ children }: { children: ReactNode }) {
  return <SmartAccountKitProvider>{children}</SmartAccountKitProvider>;
}
