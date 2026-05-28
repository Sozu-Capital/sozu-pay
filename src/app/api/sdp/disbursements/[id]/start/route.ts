import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { startDisbursement } from "@/lib/sdp/adminClient";

/** POST /api/sdp/disbursements/[id]/start — trigger payment batch */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  try {
    await startDisbursement(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[api/sdp/disbursements/[id]/start]", msg);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
