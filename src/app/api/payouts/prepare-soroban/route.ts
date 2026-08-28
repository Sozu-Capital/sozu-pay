import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSession } from "@/lib/auth/session";
import { requireStellarPayoutAccess } from "@/lib/auth/disbursement-auth";
import { getOrganizationForUser } from "@/lib/db/organizations";
import { getMemberSmartAccount } from "@/lib/db/smart-accounts";
import {
  buildUnsignedSorobanPayout,
  resolveOrgTreasuryContractId,
} from "@/lib/stellar/org-treasury";
import {
  PayoutFundsError,
  formatPayoutFundsError,
  formatSorobanPayoutError,
} from "@/lib/stellar/soroban-payout-errors";
import { LOCALE_COOKIE, readServerLocaleCookie } from "@/lib/i18n/locale";

/**
 * POST /api/payouts/prepare-soroban
 * Build unsigned disbursement_wallet.payout tx for passkey signing.
 *
 * Body: { recipientAddress: string, amount: string, payoutId?: string }
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const gate = await requireStellarPayoutAccess(session.id);
  if (!gate.ok) return gate.response;
  const user = gate.user;
  if (!user.org_id) {
    return NextResponse.json({ error: "Only admins can prepare Soroban payouts." }, { status: 403 });
  }

  const org = await getOrganizationForUser(user.org_id);
  if (!org?.soroban_contract_id) {
    return NextResponse.json(
      { error: "Organization has no Soroban disbursement contract.", code: "NO_SOROBAN_CONTRACT" },
      { status: 400 }
    );
  }

  const memberSa = await getMemberSmartAccount(user.org_id, user.id);
  if (!memberSa) {
    return NextResponse.json(
      { error: "Member passkey smart wallet required.", code: "MEMBER_SMART_WALLET_REQUIRED" },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const recipientAddress = typeof body.recipientAddress === "string" ? body.recipientAddress.trim() : "";
  const amount = typeof body.amount === "string" ? body.amount.trim() : "";
  if (!recipientAddress || !amount) {
    return NextResponse.json({ error: "recipientAddress and amount are required." }, { status: 400 });
  }

  const locale = readServerLocaleCookie((await cookies()).get(LOCALE_COOKIE)?.value);

  try {
    const treasuryContractId = resolveOrgTreasuryContractId(org);
    const prepared = await buildUnsignedSorobanPayout({
      disbursementContractId: org.soroban_contract_id,
      callerSmartAccountId: memberSa.contract_id,
      recipientAddress,
      amount,
      treasuryContractId,
    });
    return NextResponse.json({
      envelopeXdr: prepared.envelopeXdr,
      network: prepared.network,
      disbursementContractId: org.soroban_contract_id,
      callerSmartAccountId: memberSa.contract_id,
      treasuryContractId: treasuryContractId ?? null,
    });
  } catch (e) {
    if (e instanceof PayoutFundsError) {
      return NextResponse.json(
        {
          error: formatPayoutFundsError(e, locale),
          code: e.code,
          disbursementBalance: e.disbursementBalance,
          requestedAmount: e.requestedAmount,
          treasuryBalance: e.treasuryBalance,
        },
        { status: 400 }
      );
    }
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[api/payouts/prepare-soroban]", msg);
    return NextResponse.json({ error: formatSorobanPayoutError(msg, locale) }, { status: 502 });
  }
}
