import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSession } from "@/lib/auth/session";
import { requireDisbursementAuthorized } from "@/lib/auth/disbursement-auth";
import { getWithdrawalForOrg, markWithdrawalReleased } from "@/lib/db/withdrawal-requests";
import { verifyPasskeyAuthorization } from "@/lib/signing-sessions/verify-passkey";
import { getOffRampTreasuryAddress } from "@/lib/stellar/off-ramp-release";
import { submitSignedSorobanEnvelope } from "@/lib/stellar/org-treasury";
import { formatSorobanPayoutError } from "@/lib/stellar/soroban-payout-errors";
import { LOCALE_COOKIE, readServerLocaleCookie } from "@/lib/i18n/locale";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * POST /api/cashout/[id]/release/submit
 * Submit passkey-signed envelope; marks withdrawal completed.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const auth = await requireDisbursementAuthorized(session.id);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const orgId = auth.user.org_id;
  if (!orgId) return NextResponse.json({ error: "No organization" }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const signedEnvelopeXdr =
    typeof body.signedEnvelopeXdr === "string" ? body.signedEnvelopeXdr.trim() : "";
  const credentialId = typeof body.credentialId === "string" ? body.credentialId.trim() : "";
  const contractId = typeof body.contractId === "string" ? body.contractId.trim() : "";

  if (!signedEnvelopeXdr || !credentialId || !contractId) {
    return NextResponse.json(
      { error: "signedEnvelopeXdr, credentialId, and contractId are required." },
      { status: 400 },
    );
  }

  const withdrawal = await getWithdrawalForOrg(id, orgId);
  if (!withdrawal) {
    return NextResponse.json({ error: "Withdrawal not found" }, { status: 404 });
  }
  if (withdrawal.status !== "processing") {
    return NextResponse.json({ error: "Withdrawal is not awaiting USDC release." }, { status: 409 });
  }

  const verified = await verifyPasskeyAuthorization({
    user: auth.user,
    credentialId,
    contractId,
    disbursementId: withdrawal.id,
    sessionId: `off-ramp-release-${withdrawal.id}`,
  });
  if (!verified.ok) {
    return NextResponse.json({ error: verified.error, code: verified.code }, { status: 403 });
  }

  const locale = readServerLocaleCookie((await cookies()).get(LOCALE_COOKIE)?.value);
  let destination: string;
  try {
    destination = getOffRampTreasuryAddress();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 503 });
  }

  try {
    const txHash = await submitSignedSorobanEnvelope(signedEnvelopeXdr, locale);
    const updated = await markWithdrawalReleased({
      id: withdrawal.id,
      orgId,
      releaseTxHash: txHash,
      releaseDestinationAddress: destination,
    });

    if (!updated) {
      return NextResponse.json(
        { error: "USDC sent but failed to update withdrawal record. Contact support.", stellarTxHash: txHash },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      status: updated.status,
      stellarTxHash: txHash,
      releaseDestinationAddress: destination,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[cashout/release/submit]", msg);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
