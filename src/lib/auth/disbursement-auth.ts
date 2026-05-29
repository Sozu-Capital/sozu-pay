import { NextResponse } from "next/server";
import { getUserByPrivyId, type User } from "@/lib/db/users";
import { getOrganizationById } from "@/lib/db/organizations";
import { getMemberSmartAccount, type SmartAccountRow } from "@/lib/db/smart-accounts";

type AuthFailure = { ok: false; response: NextResponse };
type AdminOk = { ok: true; user: User };
type AuthorizedOk = { ok: true; user: User; smartAccount: SmartAccountRow };

function logDenied(reason: string, meta: Record<string, unknown>) {
  console.warn(`[disbursement-auth] denied: ${reason}`, meta);
}

export async function userCanManageDisbursements(user: User): Promise<boolean> {
  if (user.admin_level === "admin" || user.admin_level === "super_admin") {
    return true;
  }
  if (!user.org_id) return false;
  const org = await getOrganizationById(user.org_id);
  return !!org && org.treasury_manager_user_id === user.id;
}

/** Admin gate for creating batches and sending invites (no passkey required). */
export async function requireDisbursementAdmin(
  privyUserId: string
): Promise<AdminOk | AuthFailure> {
  const user = await getUserByPrivyId(privyUserId);
  if (!user) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (!user.allowed) {
    logDenied("user not allowlisted", { privyUserId, userId: user.id });
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: "Your profile is not activated. Contact your organization admin.",
          code: "NOT_ALLOWLISTED",
        },
        { status: 403 }
      ),
    };
  }
  if (!(await userCanManageDisbursements(user))) {
    logDenied("insufficient role for disbursements", {
      privyUserId,
      userId: user.id,
      admin_level: user.admin_level,
      orgId: user.org_id,
    });
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: "Only authorized administrators can manage batch disbursements.",
          code: "INSUFFICIENT_ROLE",
        },
        { status: 403 }
      ),
    };
  }
  if (!user.org_id) {
    return {
      ok: false,
      response: NextResponse.json({ error: "No organization selected.", code: "NO_ORG" }, { status: 400 }),
    };
  }
  return { ok: true, user };
}

/** Full gate for starting payments — requires registered passkey smart account. */
export async function requireDisbursementAuthorized(
  privyUserId: string
): Promise<AuthorizedOk | AuthFailure> {
  const admin = await requireDisbursementAdmin(privyUserId);
  if (!admin.ok) return admin;

  const smartAccount = await getMemberSmartAccount(admin.user.org_id!, admin.user.id);
  if (!smartAccount) {
    logDenied("no passkey smart account", {
      privyUserId,
      userId: admin.user.id,
      orgId: admin.user.org_id,
    });
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: "Set up your passkey smart wallet before authorizing disbursements.",
          code: "SMART_WALLET_REQUIRED",
          setupUrl: "/onboarding/setup-smart-wallet",
        },
        { status: 403 }
      ),
    };
  }

  return { ok: true, user: admin.user, smartAccount };
}
