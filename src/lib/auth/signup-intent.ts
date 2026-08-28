/**
 * Signup-intent leftovers from the retired `/merchants` door.
 * Org type is chosen at create — never inferred from URL.
 */

export const SIGNUP_INTENT_COOKIE = "sozupay_signup_intent";

const SIGNUP_INTENT_STORAGE_KEY = "sozupay_signup_intent";

export function clearClientSignupIntent(): void {
  if (typeof document !== "undefined") {
    document.cookie = `${SIGNUP_INTENT_COOKIE}=; Path=/; Max-Age=0`;
  }
  if (typeof sessionStorage !== "undefined") {
    sessionStorage.removeItem(SIGNUP_INTENT_STORAGE_KEY);
  }
}

/** Client-only: landing URL after sign-out. One door. */
export function getOnboardingSignOutLandingUrl(): string {
  return "/?fresh=1";
}
