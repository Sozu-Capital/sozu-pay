import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { requireDisbursementAuthorized } from "@/lib/auth/disbursement-auth";
import { getOrganizationForUser } from "@/lib/db/organizations";
import {
  buildUnsignedTreasuryToDistributionTransfer,
  fetchDistributionBalances,
  transferDistributionToTreasury,
} from "@/lib/stellar/distribution-transfer";
import {
  isDistributionConfigured,
  isDistributionSweepBackEnabled,
  readDistributionPublicKey,
} from "@/lib/sdp/distributionAccount";
import { resolveOrgTreasuryContractId } from "@/lib/stellar/org-treasury";
import { PayoutFundsError, formatPayoutFundsError } from "@/lib/stellar/soroban-payout-errors";
import { cookies } from "next/headers";
import { LOCALE_COOKIE, readServerLocaleCookie } from "@/lib/i18n/locale";

type TransferDirection = "to_distribution" | "to_treasury";

function parseDirection(raw: unknown): TransferDirection | null {
  if (raw === "to_distribution" || raw === "to_treasury") return raw;
  return null;
}

/**
 * POST /api/treasury/distribution/prepare
 * Body: { direction: "to_distribution" | "to_treasury", amount: string }
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const auth = await requireDisbursementAuthorized(session.id);
  if (!auth.ok) return auth.response;

  if (!isDistributionConfigured()) {
    return NextResponse.json(
      {
        error: "SDP distribution account is not configured. Set SDP_DISTRIBUTION_PUBLIC_KEY on the server.",
        code: "DISTRIBUTION_NOT_CONFIGURED",
      },
      { status: 400 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const direction = parseDirection(body.direction);
  const amount = typeof body.amount === "string" ? body.amount.trim() : "";

  if (!direction) {
    return NextResponse.json(
      { error: 'direction must be "to_distribution" or "to_treasury".', code: "INVALID_DIRECTION" },
      { status: 400 }
    );
  }
  if (!amount || !/^\d+(\.\d+)?$/.test(amount) || parseFloat(amount) <= 0) {
    return NextResponse.json({ error: "amount must be a positive number.", code: "INVALID_AMOUNT" }, { status: 400 });
  }

  const org = await getOrganizationForUser(auth.user.org_id!);
  if (!org) {
    return NextResponse.json({ error: "Organization not found." }, { status: 404 });
  }

  const locale = readServerLocaleCookie((await cookies()).get(LOCALE_COOKIE)?.value);

  try {
    if (direction === "to_treasury") {
      if (!isDistributionSweepBackEnabled()) {
        return NextResponse.json(
          {
            error:
              "Sweep-back requires SDP_DISTRIBUTION_SEED on the server (matches SDP distribution public key).",
            code: "SWEEP_BACK_NOT_CONFIGURED",
          },
          { status: 400 }
        );
      }

      const treasuryContractId = resolveOrgTreasuryContractId(org);
      if (!treasuryContractId) {
        return NextResponse.json(
          { error: "Organization has no treasury contract.", code: "NO_TREASURY" },
          { status: 400 }
        );
      }

      const balances = await fetchDistributionBalances(org);
      const distributionBal = parseFloat(balances.distributionUsdc) || 0;
      const amountNum = parseFloat(amount);
      if (distributionBal + 1e-9 < amountNum) {
        return NextResponse.json(
          {
            error: `SDP distribution has ${distributionBal.toFixed(2)} USDC but sweep requires ${amountNum} USDC.`,
            code: "INSUFFICIENT_DISTRIBUTION_BALANCE",
          },
          { status: 400 }
        );
      }

      return NextResponse.json({
        direction,
        amount,
        requiresPasskey: true,
        distributionPublicKey: readDistributionPublicKey(),
        treasuryContractId,
        distributionUsdc: balances.distributionUsdc,
      });
    }

    const prepared = await buildUnsignedTreasuryToDistributionTransfer({
      org,
      callerSmartAccountId: auth.smartAccount.contract_id,
      amount,
    });

    return NextResponse.json({
      direction,
      amount: prepared.amount,
      envelopeXdr: prepared.envelopeXdr,
      network: prepared.network,
      sourceContractId: prepared.sourceContractId,
      distributionPublicKey: prepared.distributionPublicKey,
      treasuryContractId: resolveOrgTreasuryContractId(org),
      requiresPasskey: true,
    });
  } catch (e) {
    if (e instanceof PayoutFundsError) {
      return NextResponse.json(
        { error: formatPayoutFundsError(e, locale), code: e.code },
        { status: 400 }
      );
    }
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[api/treasury/distribution/prepare]", msg);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
