import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getUserBySessionId } from "@/lib/db/users";
import { getOrganizationForUser } from "@/lib/db/organizations";
import { completePayout, getPayoutByIdAsync } from "@/lib/payouts";
import { appendAuditEvent } from "@/lib/audit";

/**
 * Complete a payout after the treasury owner signed via Pollar custodial session.
 * Body: { payoutId, stellarTxHash }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await getUserBySessionId(session.id);
    if (!user || (user.admin_level !== "super_admin" && user.admin_level !== "admin")) {
      return NextResponse.json({ error: "Only admins can complete Stellar payouts." }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const payoutId = typeof body.payoutId === "string" ? body.payoutId.trim() : "";
    const stellarTxHash = typeof body.stellarTxHash === "string" ? body.stellarTxHash.trim() : "";
    if (!payoutId || !stellarTxHash) {
      return NextResponse.json({ error: "payoutId and stellarTxHash required" }, { status: 400 });
    }

    const record = await getPayoutByIdAsync(payoutId, session.id);
    if (!record) {
      return NextResponse.json({ error: "Payout not found" }, { status: 404 });
    }
    if (record.status === "completed" && record.stellarTxHash) {
      return NextResponse.json({ payout: record });
    }
    if (record.status === "failed") {
      return NextResponse.json({ error: "Payout already failed" }, { status: 400 });
    }

    const org = (session.orgId ?? user.org_id)
      ? await getOrganizationForUser(session.orgId ?? user.org_id)
      : null;
    const fromAddress = (user.stellar_public_key ?? org?.stellar_disbursement_public_key) ?? undefined;
    const asset = body.asset === "PIZZA" ? "PIZZA" : "USDC";

    completePayout(record.id, stellarTxHash);
    appendAuditEvent(
      "payout_approved",
      `Payout ${record.amount} ${asset} to ${record.stellarAddress ?? "?"} (Pollar client tx)`,
      session.id,
      {
        signerWallet: fromAddress,
        amount: record.amount,
        stellarTxHash,
        destination: record.stellarAddress,
        recipientLabel: record.recipientLabel,
      },
    );

    const updated = (await getPayoutByIdAsync(record.id, session.id)) ?? {
      ...record,
      status: "completed" as const,
      stellarTxHash,
    };
    return NextResponse.json({ payout: updated });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Complete client payout failed";
    console.error("[payouts/complete-client]", err instanceof Error ? err.stack : String(err));
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
