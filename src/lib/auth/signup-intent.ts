/**
 * Signup intent cookie helpers.
 * Tracks whether a user landed on /merchants to default to store org type.
 */

export const SIGNUP_INTENT_COOKIE = "sozupay_signup_intent";

export type SignupIntent = "merchant" | "ngo";

export function serializeSignupIntentCookie(intent: SignupIntent): string {
  return `${SIGNUP_INTENT_COOKIE}=${intent}; Path=/; SameSite=Lax; Max-Age=${60 * 30}`;
}

export function clearSignupIntentCookie(): string {
  return `${SIGNUP_INTENT_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export function parseSignupIntent(cookieValue: string | undefined): SignupIntent | null {
  if (cookieValue === "merchant" || cookieValue === "ngo") {
    return cookieValue;
  }
  return null;
}

const SIGNUP_INTENT_STORAGE_KEY = "sozupay_signup_intent";

/** Persist merchant intent in sessionStorage (survives cookie clears mid-onboarding). */
export function persistMerchantSignupIntent(): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(SIGNUP_INTENT_STORAGE_KEY, "merchant");
}

/** Read signup intent from cookie or sessionStorage (client only). */
export function getClientSignupIntent(): SignupIntent | null {
  if (typeof document !== "undefined") {
    const cookies = document.cookie.split("; ");
    const intentCookie = cookies.find((row) => row.startsWith(`${SIGNUP_INTENT_COOKIE}=`));
    const fromCookie = parseSignupIntent(intentCookie?.split("=")[1]);
    if (fromCookie) return fromCookie;
  }
  if (typeof sessionStorage !== "undefined") {
    return parseSignupIntent(sessionStorage.getItem(SIGNUP_INTENT_STORAGE_KEY) ?? undefined);
  }
  return null;
}

export function clearClientSignupIntent(): void {
  if (typeof document !== "undefined") {
    document.cookie = `${SIGNUP_INTENT_COOKIE}=; Path=/; Max-Age=0`;
  }
  if (typeof sessionStorage !== "undefined") {
    sessionStorage.removeItem(SIGNUP_INTENT_STORAGE_KEY);
  }
}

/** Client-only: landing URL after sign-out from onboarding (merchant vs NGO home). */
export function getOnboardingSignOutLandingUrl(): string {
  return getClientSignupIntent() === "merchant" ? "/merchants?fresh=1" : "/?fresh=1";
}
