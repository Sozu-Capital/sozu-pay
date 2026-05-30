import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getUserBySessionId } from "@/lib/db/users";
import { getOrganizationForUser } from "@/lib/db/organizations";
import { migrateClassicUsdcToDisbursementContract } from "@/lib/stellar/org-treasury";

/**
 * POST /api/profile/org/treasury/migrate
 * Move USDC from classic org G wallet to disbursement contract (testnet MVP, server-decrypted secret).
 *
 * Body: { amount: string } — USDC amount e.g. "10.5"
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await getUserBySessionId(session.id);
  if (!user?.org_id || user.admin_level !== "super_admin") {
    return NextResponse.json({ error: "Only super admins can migrate treasury funds." }, { status: 403 });
  }

  const org = await getOrganizationForUser(user.org_id);
  if (!org?.soroban_contract_id) {
    return NextResponse.json(
      { error: "Bootstrap the disbursement contract before migrating USDC.", code: "NO_DISBURSEMENT_CONTRACT" },
      { status: 400 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const amount = typeof body.amount === "string" ? body.amount.trim() : "";
  if (!amount || parseFloat(amount) <= 0) {
    return NextResponse.json({ error: "amount is required." }, { status: 400 });
  }

  try {
    const txHash = await migrateClassicUsdcToDisbursementContract({
      orgId: user.org_id,
      org,
      disbursementContractId: org.soroban_contract_id,
      amount,
    });
    return NextResponse.json({ ok: true, txHash, amount, to: org.soroban_contract_id });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[api/profile/org/treasury/migrate]", msg);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
