"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useDashboardProfile } from "@/contexts/DashboardProfileContext";

/**
 * Redirect users through org onboarding when profile flags require it.
 */
export function OnboardingRedirect() {
  const router = useRouter();
  const ctx = useDashboardProfile();
  const profile = ctx?.profile ?? null;
  const loading = ctx?.loading ?? true;

  useEffect(() => {
    if (loading || !profile) return;
    if (profile.needsOrgCreation) {
      router.replace("/onboarding/create-organization");
      return;
    }
    if (profile.needsOrganization) {
      router.replace("/onboarding/organizations");
      return;
    }
    if (profile.needsSmartWalletSetup) {
      router.replace("/onboarding/setup-smart-wallet");
    }
  }, [
    loading,
    profile?.needsOrgCreation,
    profile?.needsOrganization,
    profile?.needsSmartWalletSetup,
    profile,
    router,
  ]);

  return null;
}
