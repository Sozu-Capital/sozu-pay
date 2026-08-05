import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { requireDisbursementConfirm } from "@/lib/auth/disbursement-auth";
import { getOrganizationById } from "@/lib/db/organizations";
import { requireDisbursementOrgAccess } from "@/lib/disbursements/org-scope";
import { confirmOrgTreasurySpend } from "@/lib/disbursements/org-spend";
import { isPollarMappedUser } from "@/lib/pollar/session-bridge";
import { recordManualDisbursementPaymentAsync } from "@/lib/disbursements/store";

/**
 * POST /api/disbursements/org-spend/confirm
 * Pollar-path Disbursement confirmation — no passkey. Role-gated.
 * Owner + fake auth executes; non-owner queues for treasury owner.
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const auth = await requireDisbursementConfirm(session.id);
  if (!auth.ok) return auth.response;

  if (!isPollarMappedUser(auth.user)) {
    return NextResponse.json(
      { error: "Org treasury confirm is only for Pollar-path organizations.", code: "POLLAR_PATH_REQUIRED" },
      { status: 400 },
    );
  }

  const org = await getOrganizationById(auth.user.org_id!);
  if (!org) {
    return NextResponse.json({ error: "Organization not found.", code: "NO_ORG" }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const disbursementId = typeof body.disbursementId === "string" ? body.disbursementId.trim() : "";
  const payments = Array.isArray(body.payments) ? body.payments : [];

  if (!disbursementId) {
    return NextResponse.json({ error: "disbursementId is required" }, { status: 400 });
  }

  const orgAccess = await requireDisbursementOrgAccess(disbursementId, auth.user.org_id!);
  if (!orgAccess.ok) return orgAccess.response;

  const normalized = payments
    .map((p: Record<string, unknown>) => ({
      paymentId: typeof p.paymentId === "string" ? p.paymentId : "",
      toAddress: typeof p.toAddress === "string" ? p.toAddress : "",
      amount: typeof p.amount === "string" ? p.amount : String(p.amount ?? ""),
      recipientLabel: typeof p.recipientLabel === "string" ? p.recipientLabel : undefined,
    }))
    .filter((p: { paymentId: string; toAddress: string; amount: string }) => p.paymentId && p.toAddress && p.amount);

  if (normalized.length === 0) {
    return NextResponse.json({ error: "payments[] required" }, { status: 400 });
  }

  try {
    const result = await confirmOrgTreasurySpend({
      org,
      user: auth.user,
      disbursementId,
      payments: normalized,
    });

    if (result.outcome === "executed") {
      const actor = {
        userId: String(auth.user.id),
        label: result.spendRequest.approvedByLabel ?? result.spendRequest.requestedByLabel,
      };
      for (let i = 0; i < normalized.length; i++) {
        const p = normalized[i]!;
        const txHash = result.txHashes[i] ?? result.txHashes[0]!;
        await recordManualDisbursementPaymentAsync(disbursementId, actor, {
          paymentId: p.paymentId,
          txHash,
          amount: p.amount,
          recipientAddress: p.toAddress,
          recipientLabel: p.recipientLabel ?? p.toAddress,
        });
      }
    }

    return NextResponse.json({
      outcome: result.outcome,
      spendRequestId: result.spendRequest.id,
      totalAmount: result.spendRequest.totalAmount,
      txHashes: result.outcome === "executed" ? result.txHashes : undefined,
      fromAddress: result.spendRequest.fromAddress,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Confirm failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
