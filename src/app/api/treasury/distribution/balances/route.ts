import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { requireDisbursementAdmin } from "@/lib/auth/disbursement-auth";
import { getOrganizationForUser } from "@/lib/db/organizations";
import { fetchDistributionBalances } from "@/lib/stellar/distribution-transfer";
import { isDistributionConfigured } from "@/lib/sdp/distributionAccount";

/**
 * GET /api/treasury/distribution/balances
 * Org Soroban treasury/disbursement vs SDP distribution account balances.
 */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const auth = await requireDisbursementAdmin(session.id);
  if (!auth.ok) return auth.response;

  const org = await getOrganizationForUser(auth.user.org_id!);
  if (!org) {
    return NextResponse.json({ error: "Organization not found." }, { status: 404 });
  }

  try {
    const balances = await fetchDistributionBalances(org);
    return NextResponse.json({
      configured: isDistributionConfigured(),
      ...balances,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[api/treasury/distribution/balances]", msg);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
