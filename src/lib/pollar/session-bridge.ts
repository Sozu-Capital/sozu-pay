import type { PollarVerifiedIdentity } from "./types";

/** Minimal user shape needed for redirect planning (avoids DB import in unit tests). */
export type PollarBridgeUser = {
  org_id: string | null;
  /** Distinct orgs the user can open. >1 means do not auto-select an org. */
  membershipCount?: number;
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
 * - multiple orgs → picker (never silently switch org)
 * - single primary org → dashboard
 * - otherwise create-org
 */
export function resolvePollarPostAuthRedirect(
  user: PollarBridgeUser,
  returnTo?: string,
): string {
  if (returnTo && returnTo.startsWith("/")) return returnTo;
  if ((user.membershipCount ?? 0) > 1) return "/onboarding/organizations";
  if (user.org_id) return "/dashboard";
  return "/onboarding/create-organization";
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
      : "/onboarding/create-organization";
  return { privyUserId, email, redirect };
}
