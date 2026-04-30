import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getUserByPrivyId } from "@/lib/db/users";
import { getOrganizationForUser } from "@/lib/db/organizations";
import { getUsdcBalance } from "@/lib/stellar/balance";
import { rampProvider } from "@/lib/ramp/provider";
import { createWithdrawalRequest, listWithdrawalRequestsForOrg } from "@/lib/db/withdrawal-requests";

/**
 * GET /api/cashout – list recent withdrawal requests for the authenticated org.
 */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await getUserByPrivyId(session.id);
  const orgId = session.orgId ?? user?.org_id ?? null;
  if (!orgId) return NextResponse.json({ withdrawals: [] });

  const withdrawals = await listWithdrawalRequestsForOrg(orgId, 20);
  return NextResponse.json({ withdrawals });
}

/**
 * POST /api/cashout
 * Validates balance, calls ramp off-ramp, persists withdrawal request.
 * Body: { amountUsd, bankAccountHolder, bankCountry, bankAccountNumber, bankRoutingCode?, bankCurrency? }
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const amountUsd = typeof body.amountUsd === "string" ? body.amountUsd.trim() : "";
  const bankAccountHolder = typeof body.bankAccountHolder === "string" ? body.bankAccountHolder.trim() : "";
  const bankCountry = typeof body.bankCountry === "string" ? body.bankCountry.trim().toUpperCase() : "";
  const bankAccountNumber = typeof body.bankAccountNumber === "string" ? body.bankAccountNumber.trim() : "";
  const bankRoutingCode = typeof body.bankRoutingCode === "string" ? body.bankRoutingCode.trim() : undefined;
  const bankCurrency = typeof body.bankCurrency === "string" ? body.bankCurrency.trim().toUpperCase() : undefined;

  const amount = parseFloat(amountUsd);
  if (!isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "amountUsd must be a positive number" }, { status: 400 });
  }
  if (!bankAccountHolder || !bankCountry || !bankAccountNumber) {
    return NextResponse.json({ error: "bankAccountHolder, bankCountry, and bankAccountNumber are required" }, { status: 400 });
  }

  const user = await getUserByPrivyId(session.id);
  const orgId = session.orgId ?? user?.org_id ?? null;
  if (!orgId) return NextResponse.json({ error: "No organization" }, { status: 403 });

  const org = await getOrganizationForUser(orgId);
  const sourceAddress = org?.stellar_disbursement_public_key ?? null;
  if (!sourceAddress) {
    return NextResponse.json({ error: "Organization has no Stellar wallet" }, { status: 422 });
  }

  // Balance check
  const balanceUsdc = await getUsdcBalance(sourceAddress);
  if (parseFloat(balanceUsdc) < amount) {
    return NextResponse.json(
      { error: `Insufficient balance. Available: ${balanceUsdc} USDC` },
      { status: 422 },
    );
  }

  const id = `wd_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

  let withdrawal;
  try {
    withdrawal = await rampProvider.createWithdrawal({
      orgId,
      amountUsd,
      sourceStellarAddress: sourceAddress,
      externalRef: id,
      bankAccount: {
        accountHolderName: bankAccountHolder,
        country: bankCountry,
        accountNumber: bankAccountNumber,
        routingCode: bankRoutingCode,
        currency: bankCurrency,
      },
    });
  } catch (err) {
    console.error("[cashout] ramp provider error:", err);
    return NextResponse.json({ error: "Failed to initiate withdrawal" }, { status: 502 });
  }

  try {
    await createWithdrawalRequest({
      id,
      orgId,
      amountUsd,
      sourceStellarAddress: sourceAddress,
      bankAccountHolder,
      bankCountry,
      bankAccountNumber,
      bankRoutingCode,
      bankCurrency,
      providerWithdrawalId: withdrawal.withdrawalId,
      estimatedArrival: withdrawal.estimatedArrival,
    });
  } catch (err) {
    console.error("[cashout] DB persist error:", err);
  }

  return NextResponse.json({
    id,
    status: withdrawal.status,
    estimatedArrival: withdrawal.estimatedArrival ?? null,
  });
}
