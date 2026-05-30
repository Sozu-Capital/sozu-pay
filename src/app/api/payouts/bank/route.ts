import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getUserBySessionId } from "@/lib/db/users";
import { getOrganizationForUser } from "@/lib/db/organizations";
import { getUsdcBalance } from "@/lib/stellar/balance";
import { rampProvider } from "@/lib/ramp/provider";
import { createWithdrawalRequest } from "@/lib/db/withdrawal-requests";
import { appendAuditEvent } from "@/lib/audit";

/**
 * POST /api/payouts/bank
 * Off-ramp payout to a supplier's bank account.
 * Uses the same ramp provider as cash-out, with a different destination.
 *
 * Body: {
 *   amountUsd: string,
 *   recipientName: string,          // label for audit + display
 *   bankAccountHolder: string,
 *   bankCountry: string,            // ISO-3166-1 alpha-2
 *   bankAccountNumber: string,
 *   bankRoutingCode?: string,
 *   bankCurrency?: string,
 * }
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const amountUsd = typeof body.amountUsd === "string" ? body.amountUsd.trim() : "";
  const recipientName = typeof body.recipientName === "string" ? body.recipientName.trim() : "Supplier";
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
    return NextResponse.json(
      { error: "bankAccountHolder, bankCountry, and bankAccountNumber are required" },
      { status: 400 },
    );
  }

  const user = await getUserBySessionId(session.id);
  const orgId = session.orgId ?? user?.org_id ?? null;
  if (!orgId) return NextResponse.json({ error: "No organization" }, { status: 403 });

  const org = await getOrganizationForUser(orgId);
  const sourceAddress = org?.stellar_disbursement_public_key ?? null;
  if (!sourceAddress) {
    return NextResponse.json({ error: "Organization has no Stellar wallet configured" }, { status: 422 });
  }

  const balanceUsdc = await getUsdcBalance(sourceAddress);
  if (parseFloat(balanceUsdc) < amount) {
    return NextResponse.json(
      { error: `Insufficient balance. Available: ${balanceUsdc} USDC` },
      { status: 422 },
    );
  }

  const id = `pb_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

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
    console.error("[payouts/bank] ramp provider error:", err);
    return NextResponse.json({ error: "Failed to initiate bank payout" }, { status: 502 });
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
    console.error("[payouts/bank] DB persist error:", err);
  }

  try {
    appendAuditEvent(
      "bank_payout",
      `Bank payout of $${amountUsd} USD to ${recipientName} (${bankCountry})`,
      session.id,
      { amount: amountUsd, recipientLabel: recipientName },
    );
  } catch {
    // audit is non-fatal
  }

  return NextResponse.json({
    id,
    status: withdrawal.status,
    estimatedArrival: withdrawal.estimatedArrival ?? null,
  });
}
