import { NextResponse } from "next/server";
import {
  getUserBySessionId,
  promoteOrgCreator,
  setUserAllowed,
  type User,
} from "@/lib/db/users";
import {
  getOrganizationById,
  updateOrganizationTreasuryManager,
  type Organization,
} from "@/lib/db/organizations";
import { getMemberSmartAccount, type SmartAccountRow } from "@/lib/db/smart-accounts";

type AuthFailure = { ok: false; response: NextResponse };
type AdminOk = { ok: true; user: User };
type AuthorizedOk = { ok: true; user: User; smartAccount: SmartAccountRow };

function logDenied(reason: string, meta: Record<string, unknown>) {
  console.warn(`[disbursement-auth] denied: ${reason}`, meta);
}

export function canManageDisbursements(user: User, org: Organization | null): boolean {
  if (user.admin_level === "admin" || user.admin_level === "super_admin") {
    return true;
  }
  if (!user.org_id || !org) return false;
  return org.treasury_manager_user_id === user.id;
}

export async function userCanManageDisbursements(user: User): Promise<boolean> {
  if (user.admin_level === "admin" || user.admin_level === "super_admin") {
    return true;
  }
  if (!user.org_id) return false;
  const org = await getOrganizationById(user.org_id);
  return canManageDisbursements(user, org);
}

/** Org admins and treasury managers are auto-activated (no manual allowlist step). */
export async function ensureDisbursementManagerActivated(user: User): Promise<User> {
  if (user.allowed) return user;
  if (!(await userCanManageDisbursements(user))) return user;
  const updated = await setUserAllowed(String(user.id), true);
  return updated ?? user;
}

/** Backfill treasury manager + super_admin for org creators on older rows. */
export async function repairOrgCreatorAccess(user: User): Promise<User> {
  if (!user.org_id) return user;

  const org = await getOrganizationById(user.org_id);
  if (!org) return ensureDisbursementManagerActivated(user);

  const isTreasuryManager = org.treasury_manager_user_id === user.id;
  const isOrgAdmin = user.admin_level === "admin" || user.admin_level === "super_admin";

  if (org.treasury_manager_user_id == null) {
    const memberSa = await getMemberSmartAccount(org.id, user.id);
    if (memberSa || isOrgAdmin) {
      await updateOrganizationTreasuryManager(org.id, user.id);
      const promoted = await promoteOrgCreator(user.privy_user_id, org.id);
      return promoted ?? ensureDisbursementManagerActivated(user);
    }
  }

  if (isTreasuryManager && !isOrgAdmin) {
    const promoted = await promoteOrgCreator(user.privy_user_id, org.id);
    return promoted ?? ensureDisbursementManagerActivated(user);
  }

  return ensureDisbursementManagerActivated(user);
}

/** Admin gate for creating batches and sending invites (no passkey required). */
export async function requireDisbursementAdmin(
  sessionId: string
): Promise<AdminOk | AuthFailure> {
  let user = await getUserBySessionId(sessionId);
  if (!user) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Unauthorized", code: "SESSION_USER_NOT_FOUND" },
        { status: 401 }
      ),
    };
  }

  user = await repairOrgCreatorAccess(user);

  if (!(await userCanManageDisbursements(user))) {
    logDenied("insufficient role for disbursements", {
      sessionId,
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
  sessionId: string
): Promise<AuthorizedOk | AuthFailure> {
  const admin = await requireDisbursementAdmin(sessionId);
  if (!admin.ok) return admin;

  const smartAccount = await getMemberSmartAccount(admin.user.org_id!, admin.user.id);
  if (!smartAccount) {
    logDenied("no passkey smart account", {
      sessionId,
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
