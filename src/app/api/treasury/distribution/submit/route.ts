import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSession } from "@/lib/auth/session";
import { requireDisbursementAuthorized } from "@/lib/auth/disbursement-auth";
import { getOrganizationForUser } from "@/lib/db/organizations";
import { actorLabelFromUser } from "@/lib/disbursements/store";
import { appendAuditEvent } from "@/lib/audit";
import { verifyPasskeyAuthorization } from "@/lib/signing-sessions/verify-passkey";
import {
  submitSignedSorobanEnvelope,
  transferDistributionToTreasury,
} from "@/lib/stellar/distribution-transfer";
import { resolveOrgTreasuryContractId } from "@/lib/stellar/org-treasury";
import { formatSorobanPayoutError } from "@/lib/stellar/soroban-payout-errors";
import { readDistributionPublicKey } from "@/lib/sdp/distributionAccount";
import { LOCALE_COOKIE, readServerLocaleCookie } from "@/lib/i18n/locale";

type TransferDirection = "to_distribution" | "to_treasury";

function parseDirection(raw: unknown): TransferDirection | null {
  if (raw === "to_distribution" || raw === "to_treasury") return raw;
  return null;
}

/**
 * POST /api/treasury/distribution/submit
 * Body:
 *   direction, amount
 *   to_distribution: signedEnvelopeXdr, credentialId, contractId
 *   to_treasury: credentialId, contractId (passkey gate; server signs with distribution seed)
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const auth = await requireDisbursementAuthorized(session.id);
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => ({}));
  const direction = parseDirection(body.direction);
  const amount = typeof body.amount === "string" ? body.amount.trim() : "";
  const signedEnvelopeXdr =
    typeof body.signedEnvelopeXdr === "string" ? body.signedEnvelopeXdr.trim() : "";
  const credentialId = typeof body.credentialId === "string" ? body.credentialId.trim() : "";
  const contractId = typeof body.contractId === "string" ? body.contractId.trim() : "";

  if (!direction) {
    return NextResponse.json({ error: "Invalid direction.", code: "INVALID_DIRECTION" }, { status: 400 });
  }
  if (!amount) {
    return NextResponse.json({ error: "amount is required.", code: "INVALID_AMOUNT" }, { status: 400 });
  }
  if (!credentialId || !contractId) {
    return NextResponse.json(
      { error: "Passkey authorization required (credentialId and contractId).", code: "PASSKEY_REQUIRED" },
      { status: 403 }
    );
  }

  const verified = await verifyPasskeyAuthorization({
    user: auth.user,
    credentialId,
    contractId,
    disbursementId: "treasury-distribution-transfer",
    sessionId: `transfer-${direction}`,
  });
  if (!verified.ok) {
    return NextResponse.json({ error: verified.error, code: verified.code }, { status: 403 });
  }

  const org = await getOrganizationForUser(auth.user.org_id!);
  if (!org) {
    return NextResponse.json({ error: "Organization not found." }, { status: 404 });
  }

  const locale = readServerLocaleCookie((await cookies()).get(LOCALE_COOKIE)?.value);
  const actorLabel = actorLabelFromUser(auth.user);
  const distributionPk = readDistributionPublicKey() || "";

  try {
    if (direction === "to_distribution") {
      if (!signedEnvelopeXdr) {
        return NextResponse.json(
          { error: "signedEnvelopeXdr is required for treasury → distribution.", code: "MISSING_ENVELOPE" },
          { status: 400 }
        );
      }

      const txHash = await submitSignedSorobanEnvelope(signedEnvelopeXdr, locale);
      appendAuditEvent(
        "treasury_to_distribution",
        `${actorLabel} moved ${amount} USDC from org treasury to SDP distribution (${distributionPk.slice(0, 8)}…).`,
        session.id,
        {
          signerWallet: contractId,
          amount,
          stellarTxHash: txHash,
          destination: distributionPk,
          recipientLabel: "SDP distribution",
        }
      );

      return NextResponse.json({ ok: true, direction, amount, stellarTxHash: txHash });
    }

    const treasuryContractId = resolveOrgTreasuryContractId(org);
    if (!treasuryContractId) {
      return NextResponse.json({ error: "No treasury contract.", code: "NO_TREASURY" }, { status: 400 });
    }

    const txHash = await transferDistributionToTreasury({
      org,
      amount,
      treasuryContractId,
    });
    appendAuditEvent(
      "distribution_to_treasury",
      `${actorLabel} swept ${amount} USDC from SDP distribution back to org treasury (${treasuryContractId.slice(0, 8)}…).`,
      session.id,
      {
        signerWallet: contractId,
        amount,
        stellarTxHash: txHash,
        destination: treasuryContractId,
        recipientLabel: "Org treasury",
      }
    );

    return NextResponse.json({ ok: true, direction, amount, stellarTxHash: txHash });
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e);
    const msg = formatSorobanPayoutError(raw, locale);
    console.error("[api/treasury/distribution/submit]", raw);
    return NextResponse.json({ error: msg, code: "TRANSFER_FAILED" }, { status: 502 });
  }
}
