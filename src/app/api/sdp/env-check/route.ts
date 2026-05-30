import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { requireDisbursementAdmin } from "@/lib/auth/disbursement-auth";
import { getSdpConfigStatus } from "@/lib/sdp/env";

export const dynamic = "force-dynamic";

/**
 * GET /api/sdp/env-check — booleans only; confirms Vercel env is visible at runtime.
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const auth = await requireDisbursementAdmin(session.id);
  if (!auth.ok) return auth.response;

  const status = getSdpConfigStatus();
  return NextResponse.json({
    ok: status.configured,
    ...status,
    hint: status.configured
      ? "SDP env vars are present. If API calls fail, check credentials and SDP_TENANT_NAME."
      : "One or more SDP_* vars are empty at runtime — redeploy after setting them on Vercel Production.",
  });
}
