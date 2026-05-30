import type { User } from "@/lib/db/users";
import { getSupabase } from "@/lib/supabase/server";

/**
 * Where to send the user after passkey login/register (mirrors LoginPageContent Privy flow).
 */
export async function resolvePostAuthRedirect(
  user: User,
  returnTo?: string
): Promise<string> {
  if (returnTo && returnTo.startsWith("/")) return returnTo;

  if (user.admin_level === "super_admin" && !user.org_id) {
    return "/onboarding/create-organization";
  }

  if (!user.org_id) {
    return "/onboarding/organizations";
  }

  const { data: memberSa } = await getSupabase()
    .from("smart_accounts")
    .select("id")
    .eq("user_id", user.id)
    .eq("type", "member")
    .limit(1)
    .maybeSingle();

  if (!memberSa) {
    return "/onboarding/setup-smart-wallet";
  }

  return "/dashboard";
}
