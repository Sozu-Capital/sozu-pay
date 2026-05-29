import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { requireDisbursementAuthorized } from "@/lib/auth/disbursement-auth";
import { getDisbursement } from "@/lib/sdp/adminClient";
import { createDisbursementSigningSession } from "@/lib/signing-sessions/store";
import { logPasskeyEvent } from "@/lib/passkey/log";

/**
 * POST /api/sdp/disbursements/[id]/authorize/prepare
 * Creates a short-lived signing session before starting payments.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const auth = await requireDisbursementAuthorized(session.id);
  if (!auth.ok) return auth.response;

  const { id: disbursementId } = await params;

  try {
    const disbursement = await getDisbursement(disbursementId);
    const signingSession = createDisbursementSigningSession({
      disbursementId,
      userId: auth.user.id,
      privyUserId: session.id,
      orgId: auth.user.org_id!,
      disbursementName: disbursement.name,
      disbursementSummary: {
        totalPayments: disbursement.total_payments,
        totalAmount: disbursement.total_amount,
        assetCode: disbursement.asset?.code ?? "USDC",
      },
      userAgent: request.headers.get("user-agent") ?? undefined,
    });

    const origin =
      request.headers.get("origin") ??
      process.env.NEXT_PUBLIC_APP_URL ??
      "http://localhost:3000";
    const authorizeUrl = `${origin.replace(/\/$/, "")}/sign/${signingSession.id}`;

    logPasskeyEvent("info", {
      action: "authorize_prepare",
      userId: auth.user.id,
      disbursementId,
      sessionId: signingSession.id,
    });

    return NextResponse.json({
      sessionId: signingSession.id,
      authorizeUrl,
      expiresAt: signingSession.expiresAt,
      disbursement: {
        id: disbursement.id,
        name: disbursement.name,
        status: disbursement.status,
        totalPayments: disbursement.total_payments,
        totalAmount: disbursement.total_amount,
        assetCode: disbursement.asset?.code ?? "USDC",
      },
      smartAccount: {
        contractId: auth.smartAccount.contract_id,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[api/sdp/disbursements/[id]/authorize/prepare]", msg);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
