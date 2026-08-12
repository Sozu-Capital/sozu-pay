import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getUserBySessionId } from "@/lib/db/users";
import { getOrganizationForUser } from "@/lib/db/organizations";
import {
  CHECKOUT_SETUP_WALLET_PATH,
  isCheckoutSettleReady,
} from "@/lib/checkout/ready";

/**
 * GET /api/checkout/ready
 * POS preflight: org settle-to address present? Same helper as POST /api/checkout/create.
 * Not user trustline-status. No Horizon.
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await getUserBySessionId(session.id);
  const orgId = session.orgId ?? user?.org_id ?? null;
  if (!orgId) {
    return NextResponse.json({
      ready: false,
      setupUrl: CHECKOUT_SETUP_WALLET_PATH,
    });
  }

  const org = await getOrganizationForUser(orgId);
  if (!isCheckoutSettleReady(org)) {
    return NextResponse.json({
      ready: false,
      setupUrl: CHECKOUT_SETUP_WALLET_PATH,
    });
  }

  return NextResponse.json({ ready: true });
}
