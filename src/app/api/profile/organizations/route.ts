import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getUserBySessionId } from "@/lib/db/users";
import { getOrganizationById } from "@/lib/db/organizations";
import { listAccessibleOrgIds } from "@/lib/db/org-members";

/**
 * GET /api/profile/organizations – list organizations the current user can access.
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const user = await getUserBySessionId(session.id);
    if (!user) {
      return NextResponse.json({ organizations: [], canCreate: true });
    }

    const extraIds = await listAccessibleOrgIds({
      userId: user.id,
      primaryOrgId: user.org_id,
      sessionOrgId: session.orgId,
      staffPublicKey: user.stellar_public_key,
    });
    const ids = extraIds;
    const organizations: { id: string; name: string }[] = [];
    for (const id of ids) {
      const org = await getOrganizationById(id);
      if (org) organizations.push({ id: org.id, name: org.name });
    }

    return NextResponse.json({
      organizations,
      canCreate: true,
      activeOrgId: session.orgId ?? user.org_id ?? null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[profile/organizations]", message, err);
    const isConfig = message.includes("Missing Supabase") || message.includes("env");
    return NextResponse.json(
      { error: isConfig ? "Server configuration error." : "Failed to load organizations." },
      { status: isConfig ? 503 : 500 }
    );
  }
}
