import type { User } from "@/lib/db/users";

/**
 * After passkey login/register, resolve where to send the user.
 * - returnTo (from ?returnTo= param) always wins.
 * - Users with an org already set go straight to /dashboard — skip the org picker.
 * - Users without an org still go to the org picker.
 */
export async function resolvePostAuthRedirect(
  user: User,
  returnTo?: string
): Promise<string> {
  if (returnTo && returnTo.startsWith("/")) return returnTo;
  if (user.org_id) return "/dashboard";
  return "/onboarding/organizations";
}
