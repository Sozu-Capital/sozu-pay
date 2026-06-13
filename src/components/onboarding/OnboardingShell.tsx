"use client";

import type { ReactNode } from "react";
import { OnboardingSignOutButton } from "@/components/onboarding/OnboardingSignOutButton";

export function OnboardingShell({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <OnboardingSignOutButton />
    </>
  );
}
