import { NextRequest, NextResponse } from "next/server";
import { Transaction } from "@stellar/stellar-sdk";
import { getSession } from "@/lib/auth/session";
import { getUserByPrivyId } from "@/lib/db/users";
import { getOrganizationForUser } from "@/lib/db/organizations";
import { getPayoutById, completePayout, failPayout } from "@/lib/payouts";
import { appendAuditEvent } from "@/lib/audit";
import { submitSignedEnvelope } from "@/lib/stellar/sendUsdc";
import { Networks } from "@stellar/stellar-sdk";

/**
 * POST /api/payouts/submit-signed
 * Submit a client-signed Stellar payout envelope (payout password flow).
 * Body: { signedEnvelopeXdr: string, payoutId: string }
 * Verifies session, payout ownership, signer matches org, then submits to Horizon.
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await getUserByPrivyId(session.id);
  if (!user || user.admin_level !== "super_admin") {
    return NextResponse.json(
      { error: "Only super admins can submit signed payouts." },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const signedEnvelopeXdr = typeof body.signedEnvelopeXdr === "string" ? body.signedEnvelopeXdr.trim() : "";
  const payoutId = typeof body.payoutId === "string" ? body.payoutId.trim() : "";

  if (!signedEnvelopeXdr || !payoutId) {
    return NextResponse.json(
      { error: "signedEnvelopeXdr and payoutId are required." },
      { status: 400 }
    );
  }

  const payout = getPayoutById(payoutId, session.id);
  if (!payout) {
    return NextResponse.json(
      { error: "Payout not found or access denied." },
      { status: 404 }
    );
  }
  if (payout.status !== "pending") {
    return NextResponse.json(
      { error: "Payout already completed or failed." },
      { status: 400 }
    );
  }
  if (payout.type !== "to_stellar" || !payout.stellarAddress) {
    return NextResponse.json(
      { error: "Payout is not a Stellar payout." },
      { status: 400 }
    );
  }

  const orgId = user.org_id ?? null;
  if (!orgId) {
    return NextResponse.json(
      { error: "No organization." },
      { status: 400 }
    );
  }
  const org = await getOrganizationForUser(orgId);
  if (!org?.stellar_disbursement_public_key) {
    return NextResponse.json(
      { error: "Organization has no disbursement wallet." },
      { status: 400 }
    );
  }

  const networkPassphrase =
    process.env.STELLAR_NETWORK === "public" ? Networks.PUBLIC : Networks.TESTNET;
  let transaction: Transaction;
  try {
    transaction = new Transaction(signedEnvelopeXdr, networkPassphrase);
  } catch {
    return NextResponse.json(
      { error: "Invalid signed envelope XDR." },
      { status: 400 }
    );
  }

  const sourceAccount = (transaction as { source?: string }).source ?? (transaction as { getSourceAccount?: () => { accountId: () => string } }).getSourceAccount?.()?.accountId?.();
  const signerPublicKey = typeof sourceAccount === "string" ? sourceAccount : null;
  if (!signerPublicKey || signerPublicKey !== org.stellar_disbursement_public_key) {
    return NextResponse.json(
      { error: "Transaction signer does not match organization disbursement wallet." },
      { status: 400 }
    );
  }

  try {
    const txHash = await submitSignedEnvelope(signedEnvelopeXdr, networkPassphrase);
    completePayout(payoutId, txHash);
    appendAuditEvent(
      "payout_approved",
      `Payout ${payout.amount} USDC to ${payout.stellarAddress} (signed with payout password by ${session.email ?? session.id})`,
      session.id,
      {
        signerWallet: org.stellar_disbursement_public_key,
        amount: payout.amount,
        stellarTxHash: txHash,
        destination: payout.stellarAddress,
        recipientLabel: payout.recipientLabel,
      }
    );
    const updated = getPayoutById(payoutId, session.id);
    return NextResponse.json({
      payout: { ...updated!, stellarTxHash: txHash },
    });
  } catch (err) {
    failPayout(payoutId);
    const msg = err instanceof Error ? err.message : "Stellar transaction failed";
    console.error("[payouts/submit-signed] submit error:", err instanceof Error ? err.stack : String(err));
    return NextResponse.json(
      { error: `Payout failed: ${msg}`, payoutId },
      { status: 502 }
    );
  }
}
