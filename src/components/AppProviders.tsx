"use client";

import type { ReactNode } from "react";
import { SmartAccountKitProvider } from "@/components/SmartAccountKitProvider";
import { SignOutProvider } from "@/lib/auth/sign-out-context";
import { isPrivyAuth } from "@/lib/auth/provider";
import { useState, useEffect } from "react";

/**
 * Root providers: Smart Account Kit always; Privy only when AUTH_PROVIDER=privy.
 */
export function AppProviders({ children }: { children: ReactNode }) {
  const usePrivy = isPrivyAuth();
  const [PrivyWrapper, setPrivyWrapper] = useState<
    null | React.ComponentType<{ children: ReactNode }>
  >(null);

  useEffect(() => {
    if (!usePrivy) return;
    import("@/components/PrivyProviderWrapper").then((mod) =>
      setPrivyWrapper(() => mod.PrivyProviderWrapper)
    );
  }, [usePrivy]);

  const kit = <SmartAccountKitProvider>{children}</SmartAccountKitProvider>;

  if (!usePrivy) {
    return <SignOutProvider privyLogout={null}>{kit}</SignOutProvider>;
  }
  if (!PrivyWrapper) return kit;
  return <PrivyWrapper>{kit}</PrivyWrapper>;
}
