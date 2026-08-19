import "server-only";

import type { Organization } from "@/lib/db/organizations";
import { getUsdcBalance } from "@/lib/stellar/balance";
import { getSorobanUsdcBalance } from "@/lib/stellar/soroban-balance";
import type { SdpDisbursement, SdpReceiver } from "@/lib/sdp/adminClient";
import { receiverInviteWasSent } from "@/lib/sdp/receiverDisplay";
import { collectOrgBatchTreasuryHolders } from "@/lib/sdp/org-batch-treasury";

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

/** Check org treasury USDC before passkey Soroban or Pollar classic payouts. */
export async function validateDisbursementFunds(params: {
  org: Organization;
  disbursement: SdpDisbursement;
}): Promise<DisbursementPreflightResult> {
  const required = requiredBatchAmount(params.disbursement);
  if (required <= 0) return { ok: true };

  const holders = collectOrgBatchTreasuryHolders(params.org);

  if (holders.contractIds.length === 0 && !holders.classicG) {
    return {
      ok: false,
      code: "NO_ORG_TREASURY",
      error:
        "This organization has no treasury configured. Set up your org wallet before sending batch payments.",
    };
  }

  let orgCombined = 0;
  if (holders.contractIds.length > 0) {
    const balances = await Promise.all(
      holders.contractIds.map(async (id) => parseFloat(await getSorobanUsdcBalance(id)) || 0)
    );
    orgCombined = balances.reduce((sum, bal) => sum + bal, 0);
  } else if (holders.classicG) {
    orgCombined = parseFloat(await getUsdcBalance(holders.classicG)) || 0;
  }

  if (orgCombined + 1e-9 < required) {
    return {
      ok: false,
      code: "INSUFFICIENT_ORG_BALANCE",
      error:
        `Org treasury has ${orgCombined.toFixed(2)} USDC but this batch requires ${required.toFixed(2)} USDC. ` +
        `Deposit USDC to your org treasury, then use Distribuir to pay registered beneficiaries.`,
      details: { required, orgBalance: orgCombined },
    };
  }

  return { ok: true };
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
