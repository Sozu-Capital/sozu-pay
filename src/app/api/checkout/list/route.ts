import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getUserBySessionId } from "@/lib/db/users";
import { listCheckoutSessionsForOrg } from "@/lib/db/checkout-sessions";

/**
 * GET /api/checkout/list
 * Returns recent checkout sessions for the authenticated org.
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await getUserBySessionId(session.id);
  const orgId = session.orgId ?? user?.org_id ?? null;
  if (!orgId) {
    return NextResponse.json({ sessions: [] });
  }

  const sessions = await listCheckoutSessionsForOrg(orgId, 30);
  return NextResponse.json({ sessions });
}
