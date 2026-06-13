import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { requireDisbursementAuthorized } from "@/lib/auth/disbursement-auth";
import { getOrganizationForUser } from "@/lib/db/organizations";
import { getWithdrawalForOrg } from "@/lib/db/withdrawal-requests";
import { prepareOffRampUsdcRelease } from "@/lib/stellar/off-ramp-release";
import { resolveOrgDisbursementContractId } from "@/lib/stellar/org-treasury";
import { formatSorobanPayoutError, PayoutFundsError } from "@/lib/stellar/soroban-payout-errors";
import { cookies } from "next/headers";
import { LOCALE_COOKIE, readServerLocaleCookie } from "@/lib/i18n/locale";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * POST /api/cashout/[id]/release/prepare
 * Merchant confirms CLP received — returns Soroban envelope to sign with passkey.
 */
export async function POST(_request: NextRequest, { params }: RouteParams) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const auth = await requireDisbursementAuthorized(session.id);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const orgId = auth.user.org_id;
  if (!orgId) return NextResponse.json({ error: "No organization" }, { status: 403 });

  const withdrawal = await getWithdrawalForOrg(id, orgId);
  if (!withdrawal) {
    return NextResponse.json({ error: "Withdrawal not found" }, { status: 404 });
  }
  if (withdrawal.status !== "processing") {
    return NextResponse.json(
      {
        error:
          withdrawal.status === "pending"
            ? "Ops has not confirmed CLP deposit yet. Wait for Sozu admin to mark CLP sent."
            : "This withdrawal is no longer awaiting USDC release.",
        code: "INVALID_STATUS",
      },
      { status: 409 },
    );
  }

  const org = await getOrganizationForUser(orgId);
  if (!org) return NextResponse.json({ error: "Organization not found" }, { status: 404 });

  const locale = readServerLocaleCookie((await cookies()).get(LOCALE_COOKIE)?.value);

  try {
    const prepared = await prepareOffRampUsdcRelease({
      org,
      callerSmartAccountId: auth.smartAccount.contract_id,
      amountUsd: withdrawal.amount_usd,
    });

    return NextResponse.json({
      withdrawalId: withdrawal.id,
      amountUsd: withdrawal.amount_usd,
      destinationAddress: prepared.destinationAddress,
      envelopeXdr: prepared.envelopeXdr,
      network: prepared.network,
      disbursementContractId: resolveOrgDisbursementContractId(org),
      requiresPasskey: true,
    });
  } catch (e) {
    if (e instanceof PayoutFundsError) {
      return NextResponse.json(
        { error: formatSorobanPayoutError(e, locale), code: e.code },
        { status: 400 },
      );
    }
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
