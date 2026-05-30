import type { User } from "@/lib/db/users";

/**
 * After passkey login/register, always show the org picker unless returnTo is set.
 */
export async function resolvePostAuthRedirect(
  user: User,
  returnTo?: string
): Promise<string> {
  void user;
  if (returnTo && returnTo.startsWith("/")) return returnTo;
  return "/onboarding/organizations";
}
