import type { PollarVerifiedIdentity } from "./types";

/** Minimal user shape needed for redirect planning (avoids DB import in unit tests). */
export type PollarBridgeUser = {
  org_id: string | null;
};

/** Stable SozuPay mapping stored in users.privy_user_id for Pollar subjects. */
export function pollarPrivyUserId(subject: string): string {
  const clean = subject.trim();
  if (!clean) throw new Error("Pollar subject is required");
  if (clean.startsWith("pollar:")) return clean;
  return `pollar:${clean}`;
}

export function isPollarMappedUser(user: { privy_user_id: string }): boolean {
  return (user.privy_user_id ?? "").startsWith("pollar:");
}

/**
 * After Pollar login, where should we send the user?
 * - returnTo wins
 * - existing primary org → dashboard (resume; no forced re-onboarding)
 * - otherwise org picker / create flow
 */
export function resolvePollarPostAuthRedirect(
  user: PollarBridgeUser,
  returnTo?: string,
): string {
  if (returnTo && returnTo.startsWith("/")) return returnTo;
  if (user.org_id) return "/dashboard";
  return "/onboarding/organizations";
}

export type PollarSessionBridgeResult = {
  privyUserId: string;
  email: string;
  redirect: string;
};

/** Pure mapping used by tests — DB upsert happens in the route. */
export function planPollarSessionBridge(
  identity: PollarVerifiedIdentity,
  existingUser: PollarBridgeUser | null,
  returnTo?: string,
): PollarSessionBridgeResult {
  const privyUserId = pollarPrivyUserId(identity.subject);
  const email = identity.email.trim().toLowerCase();
  const redirect = existingUser
    ? resolvePollarPostAuthRedirect(existingUser, returnTo)
    : returnTo && returnTo.startsWith("/")
      ? returnTo
      : "/onboarding/organizations";
  return { privyUserId, email, redirect };
}
