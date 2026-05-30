import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getUserBySessionId } from "@/lib/db/users";
import { getOrganizationById } from "@/lib/db/organizations";

/**
 * GET /api/profile/organizations – list organizations the current user can access.
 * For now: single org (user.org_id). Later: expand with organization_members for multi-org.
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const user = await getUserBySessionId(session.id);
    if (!user) {
      // Session exists but user row missing (should be rare). Still allow creating an org.
      return NextResponse.json({ organizations: [], canCreate: true });
    }

    const organizations: { id: string; name: string }[] = [];
    if (user.org_id) {
      const org = await getOrganizationById(user.org_id);
      if (org) {
        organizations.push({ id: org.id, name: org.name });
      }
    }

    // We allow creating a new organization even if the user already has access to one.
    // (Creating will switch the user's active org to the newly created one.)
    const canCreate = true;

    return NextResponse.json({
      organizations,
      canCreate,
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
