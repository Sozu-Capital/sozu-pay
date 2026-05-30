import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getUserBySessionId, getPendingActivationUsers } from "@/lib/db/users";
import { getOrganizationById } from "@/lib/db/organizations";
import type { User } from "@/lib/db/users";

/**
 * GET /api/admin/pending-activations – list users who requested activation (super_admin only).
 * Returns each user with requested_org_id and requested_org_name when they requested in org context.
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const currentUser = await getUserBySessionId(session.id);
  if (!currentUser || currentUser.admin_level !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const pending = await getPendingActivationUsers();
  const withOrgNames = await Promise.all(
    pending.map(async (u: User) => {
      const requestedOrgId = u.org_id ?? null;
      let requested_org_name: string | null = null;
      if (requestedOrgId) {
        const org = await getOrganizationById(requestedOrgId);
        requested_org_name = org?.name ?? null;
      }
      return {
        ...u,
        activation_requested_org_id: requestedOrgId,
        requested_org_name,
      };
    })
  );
  return NextResponse.json({ users: withOrgNames });
}
