import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getUserByPrivyId } from "@/lib/db/users";
import { getOrganizationForUser } from "@/lib/db/organizations";
import { getMemberSmartAccount } from "@/lib/db/smart-accounts";
import { getPayoutById, completePayout, failPayout } from "@/lib/payouts";
import { appendAuditEvent } from "@/lib/audit";
import { submitSignedSorobanEnvelope } from "@/lib/stellar/org-treasury";

/**
 * POST /api/payouts/submit-signed-soroban
 * Submit passkey-signed Soroban disbursement payout.
 *
 * Body: { signedEnvelopeXdr: string, payoutId: string }
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await getUserByPrivyId(session.id);
  if (!user || (user.admin_level !== "super_admin" && user.admin_level !== "admin")) {
    return NextResponse.json({ error: "Only admins can submit Soroban payouts." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const signedEnvelopeXdr = typeof body.signedEnvelopeXdr === "string" ? body.signedEnvelopeXdr.trim() : "";
  const payoutId = typeof body.payoutId === "string" ? body.payoutId.trim() : "";

  if (!signedEnvelopeXdr || !payoutId) {
    return NextResponse.json({ error: "signedEnvelopeXdr and payoutId are required." }, { status: 400 });
  }

  const payout = getPayoutById(payoutId, session.id);
  if (!payout) {
    return NextResponse.json({ error: "Payout not found." }, { status: 404 });
  }
  if (payout.status !== "pending") {
    return NextResponse.json({ error: "Payout already completed or failed." }, { status: 400 });
  }

  const orgId = user.org_id ?? null;
  if (!orgId) return NextResponse.json({ error: "No organization." }, { status: 400 });

  const org = await getOrganizationForUser(orgId);
  if (!org?.soroban_contract_id) {
    return NextResponse.json({ error: "No Soroban disbursement contract." }, { status: 400 });
  }

  const memberSa = await getMemberSmartAccount(orgId, user.id);
  if (!memberSa) {
    return NextResponse.json({ error: "Member smart wallet not registered." }, { status: 403 });
  }

  try {
    const txHash = await submitSignedSorobanEnvelope(signedEnvelopeXdr);
    completePayout(payoutId, txHash);
    appendAuditEvent(
      "payout_approved",
      `Soroban payout ${payout.amount} USDC (passkey signed by ${session.email ?? session.id})`,
      session.id,
      {
        signerWallet: memberSa.contract_id,
        amount: payout.amount,
        stellarTxHash: txHash,
        destination: payout.stellarAddress,
        recipientLabel: payout.recipientLabel,
      }
    );
    const updated = getPayoutById(payoutId, session.id);
    return NextResponse.json({ payout: { ...updated!, stellarTxHash: txHash } });
  } catch (err) {
    failPayout(payoutId);
    const msg = err instanceof Error ? err.message : "Soroban transaction failed";
    console.error("[payouts/submit-signed-soroban]", err instanceof Error ? err.stack : String(err));
    return NextResponse.json({ error: msg, payoutId }, { status: 502 });
  }
}
