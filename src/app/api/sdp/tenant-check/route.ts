import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { requireDisbursementAdmin } from "@/lib/auth/disbursement-auth";
import {
  getConfiguredSdpTenantName,
  probeSdpTenantName,
} from "@/lib/sdp/tenantCheck";

/**
 * GET /api/sdp/tenant-check — verify SDP_TENANT_NAME matches a provisioned tenant.
 * Admin-only diagnostic for disbursement operators.
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const auth = await requireDisbursementAdmin(session.id);
  if (!auth.ok) return auth.response;

  const tenantName = getConfiguredSdpTenantName();
  const probe = await probeSdpTenantName(tenantName);

  return NextResponse.json({
    tenantName,
    sdpApiUrl: process.env.SDP_API_URL ?? null,
    tenantRecognized: probe.ok,
    detail: probe.detail,
    walletRegistrationHint: probe.ok
      ? "If recipients see 'Failed to load tenant by name', run Step 7 tenant migrations on Railway."
      : "Set SDP_TENANT_NAME to your Railway tenant name (login probe returned tenant not found).",
  });
}
