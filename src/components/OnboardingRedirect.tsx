"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useDashboardProfile } from "@/contexts/DashboardProfileContext";

/**
 * If the user has not set their payout wallet passphrase, redirect to onboarding.
 * Used in dashboard layout so existing users without stellar_payout_public_key are prompted.
 */
export function OnboardingRedirect() {
  const router = useRouter();
  const { profile } = useDashboardProfile() ?? { profile: null };

  useEffect(() => {
    if (!profile) return;
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
      return;
    }
    if (profile.needsPayoutWalletSetup) {
      router.replace("/onboarding/set-payout-wallet");
    }
  }, [profile?.needsOrgCreation, profile?.needsOrganization, profile?.needsSmartWalletSetup, profile?.needsPayoutWalletSetup, profile, router]);

  return null;
}
