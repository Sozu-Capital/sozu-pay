import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getUserBySessionId } from "@/lib/db/users";
import { cancelWithdrawalRequest } from "@/lib/db/withdrawal-requests";

type RouteContext = { params: Promise<{ id: string }> };

/** DELETE /api/cashout/[id] — merchant cancels a pending withdrawal request. */
export async function DELETE(_request: NextRequest, context: RouteContext) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;
  const user = await getUserBySessionId(session.id);
  const orgId = session.orgId ?? user?.org_id ?? null;
  if (!orgId) return NextResponse.json({ error: "No organization" }, { status: 403 });

  const cancelled = await cancelWithdrawalRequest(id, orgId);
  if (!cancelled) {
    return NextResponse.json(
      { error: "Withdrawal not found or cannot be cancelled (only pending requests)" },
      { status: 404 },
    );
  }

  return NextResponse.json({ id: cancelled.id, status: cancelled.status });
}
