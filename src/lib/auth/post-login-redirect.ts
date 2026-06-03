import type { User } from "@/lib/db/users";

/**
 * After passkey login/register, resolve where to send the user.
 * - returnTo (from ?returnTo= param) always wins.
 * - Otherwise always open the org picker so the user chooses (or creates) an org.
 */
export async function resolvePostAuthRedirect(
  _user: User,
  returnTo?: string
): Promise<string> {
  if (returnTo && returnTo.startsWith("/")) return returnTo;
  return "/onboarding/organizations";
}
