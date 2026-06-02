import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { requireDisbursementAuthorized } from "@/lib/auth/disbursement-auth";
import { getOrganizationForUser } from "@/lib/db/organizations";
import { getDisbursement, listReceivers } from "@/lib/sdp/adminClient";
import { createDisbursementSigningSession } from "@/lib/signing-sessions/store";
import { logPasskeyEvent } from "@/lib/passkey/log";
import { preflightDisbursementStart } from "@/lib/sdp/validateDisbursementStart";

/**
 * POST /api/sdp/disbursements/[id]/authorize/prepare
 * Preflight beneficiaries + balance, then create a short-lived signing session.
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
    const org = await getOrganizationForUser(auth.user.org_id!);
    if (!org) {
      return NextResponse.json({ error: "Organization not found.", code: "NO_ORG" }, { status: 400 });
    }

    const [disbursement, receivers] = await Promise.all([
      getDisbursement(disbursementId),
      listReceivers(disbursementId),
    ]);

    const preflight = await preflightDisbursementStart({ org, disbursement, receivers });
    if (!preflight.ok) {
      return NextResponse.json(
        { error: preflight.error, code: preflight.code, details: preflight.details },
        { status: 400 }
      );
    }

    const signingSession = await createDisbursementSigningSession({
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
