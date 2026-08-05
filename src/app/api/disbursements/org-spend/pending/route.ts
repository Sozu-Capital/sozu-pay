import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { requireDisbursementConfirm } from "@/lib/auth/disbursement-auth";
import { listPendingSpendRequests } from "@/lib/disbursements/spend-requests";

/** GET /api/disbursements/org-spend/pending — list approval-queue items for the org. */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const auth = await requireDisbursementConfirm(session.id);
  if (!auth.ok) return auth.response;

  const pending = listPendingSpendRequests(auth.user.org_id!);
  return NextResponse.json({ pending });
}
