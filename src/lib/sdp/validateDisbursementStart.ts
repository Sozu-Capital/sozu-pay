import "server-only";

import type { Organization } from "@/lib/db/organizations";
import { usableClassicTreasuryPublicKey } from "@/lib/pollar/types";
import {
  resolveOrgDisbursementContractId,
  resolveOrgTreasuryContractId,
} from "@/lib/stellar/org-treasury";
import { getUsdcBalance } from "@/lib/stellar/balance";
import { getSorobanUsdcBalance } from "@/lib/stellar/soroban-balance";
import type { SdpDisbursement, SdpReceiver } from "@/lib/sdp/adminClient";
import { receiverInviteWasSent } from "@/lib/sdp/receiverDisplay";
import { evaluateDisbursementFunds } from "@/lib/sdp/disbursement-paying-balance";

export type DisbursementPreflightFailure = {
  ok: false;
  code: string;
  error: string;
  details?: Record<string, string | number>;
};

export type DisbursementPreflightSuccess = { ok: true };

export type DisbursementPreflightResult =
  | DisbursementPreflightSuccess
  | DisbursementPreflightFailure;

function requiredBatchAmount(disbursement: SdpDisbursement): number {
  const total = parseFloat(disbursement.total_amount) || 0;
  const disbursed = parseFloat(disbursement.disbursed_amount ?? "0") || 0;
  return Math.max(0, total - disbursed);
}

/**
 * Start/Hotlink requires invite emails sent first.
 * SDP keeps receiver wallets in DRAFT until the batch is STARTED — registration in SozuCredit
 * happens after start, so we must NOT block on wallet lifecycle "draft".
 */
export function validateInvitesSentForStart(params: {
  invitesSentAt?: string | null;
  receivers: SdpReceiver[];
}): DisbursementPreflightResult {
  if (params.invitesSentAt) return { ok: true };

  const anyInviteOnSdp = params.receivers.some((r) => receiverInviteWasSent(r));
  if (anyInviteOnSdp) return { ok: true };

  if (params.receivers.length === 0) {
    return {
      ok: false,
      code: "NO_RECEIVERS",
      error:
        "This batch has no recipients. Add beneficiaries before starting payments or Hotlink.",
    };
  }

  return {
    ok: false,
    code: "INVITES_REQUIRED",
    error:
      params.receivers.length === 1
        ? "Send the invite email first. Starting the batch or Hotlink is blocked until the recipient has received a registration link."
        : "Send invite emails first. Starting the batch or Hotlink is blocked until at least one recipient has received a registration link.",
    details: { recipientCount: params.receivers.length },
  };
}

/** Check the paying wallet before Distribuir. Invites do not call this. */
export async function validateDisbursementFunds(params: {
  org: Organization;
  disbursement: SdpDisbursement;
}): Promise<DisbursementPreflightResult> {
  const required = requiredBatchAmount(params.disbursement);
  if (required <= 0) return { ok: true };

  const treasuryId = resolveOrgTreasuryContractId(params.org);
  const disbursementContractId = resolveOrgDisbursementContractId(params.org);
  const classicG = usableClassicTreasuryPublicKey(params.org.stellar_disbursement_public_key);

  let treasuryBal = 0;
  let disbursementBal = 0;
  if (treasuryId) {
    treasuryBal = parseFloat(await getSorobanUsdcBalance(treasuryId)) || 0;
  }
  if (disbursementContractId) {
    disbursementBal =
      disbursementContractId === treasuryId
        ? treasuryBal
        : parseFloat(await getSorobanUsdcBalance(disbursementContractId)) || 0;
  }

  // Read classic G even when a C id is set. Pollar spend pays from that G.
  const classicGBal =
    classicG && (treasuryId || disbursementContractId)
      ? parseFloat(await getUsdcBalance(classicG)) || 0
      : null;

  return evaluateDisbursementFunds({
    required,
    treasuryId,
    disbursementContractId,
    treasuryBal,
    disbursementBal,
    classicGBal,
  });
}

export async function preflightDisbursementStart(params: {
  org: Organization;
  disbursement: SdpDisbursement;
  receivers: SdpReceiver[];
  invitesSentAt?: string | null;
}): Promise<DisbursementPreflightResult> {
  const invites = validateInvitesSentForStart({
    invitesSentAt: params.invitesSentAt,
    receivers: params.receivers,
  });
  if (!invites.ok) return invites;
  return validateDisbursementFunds({
    org: params.org,
    disbursement: params.disbursement,
  });
}

/** Extract human-readable SDP error text from adminClient throw messages. */
function extractSdpErrorBody(raw: string): string {
  const text = raw.trim();
  const jsonStart = text.indexOf("{");
  if (jsonStart >= 0) {
    try {
      const parsed = JSON.parse(text.slice(jsonStart)) as { error?: string; message?: string };
      if (typeof parsed.error === "string" && parsed.error.trim()) return parsed.error.trim();
      if (typeof parsed.message === "string" && parsed.message.trim()) return parsed.message.trim();
    } catch {
      // fall through
    }
  }
  return text.replace(/^SDP \w+[^\n]*→\s*\d+:\s*/i, "").trim();
}

/** Turn raw SDP PATCH /status errors into dashboard-friendly messages. */
export function formatSdpStartError(raw: string): { code: string; error: string } {
  const extracted = extractSdpErrorBody(raw);
  const text = extracted.toLowerCase();

  if (
    /account balance|insufficient|distribution account|needs to be recharged|recharged with at least/i.test(
      text
    )
  ) {
    const amountMatch = extracted.match(/at least ([\d.]+)/i);
    const required = amountMatch?.[1] ?? "?";
    return {
      code: "SDP_DISTRIBUTION_UNDERFUNDED",
      error:
        `SDP could not auto-start this batch (Railway distribution account needs at least ${required} USDC). ` +
        `Invites were still sent — use Distribuir to pay from your org smart account once beneficiaries register.`,
    };
  }
  if (/not ready to be started/i.test(text)) {
    return {
      code: "ALREADY_STARTED",
      error:
        "This batch is already started. Use Distribuir to pay registered beneficiaries from your org smart account.",
    };
  }
  if (/409/.test(raw)) {
    return {
      code: "SDP_CONFLICT",
      error: extracted.length > 400 ? `${extracted.slice(0, 400)}…` : extracted,
    };
  }
  return { code: "SDP_START_FAILED", error: extracted.length > 400 ? `${extracted.slice(0, 400)}…` : extracted };
}
