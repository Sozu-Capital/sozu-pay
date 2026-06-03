import "server-only";

import type { Organization } from "@/lib/db/organizations";
import {
  resolveOrgDisbursementContractId,
  resolveOrgTreasuryContractId,
} from "@/lib/stellar/org-treasury";
import { getUsdcBalance } from "@/lib/stellar/balance";
import { getSorobanUsdcBalance } from "@/lib/stellar/soroban-balance";
import { readDistributionPublicKey } from "@/lib/sdp/distributionAccount";
import { resolveOrgDistributionPublicKey } from "@/lib/sdp/org-distribution";
import type { SdpDisbursement, SdpReceiver } from "@/lib/sdp/adminClient";
import { receiverInviteWasSent } from "@/lib/sdp/receiverDisplay";

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

/** Check org Soroban treasury and SDP distribution account before passkey. */
export async function validateDisbursementFunds(params: {
  org: Organization;
  disbursement: SdpDisbursement;
}): Promise<DisbursementPreflightResult> {
  const required = requiredBatchAmount(params.disbursement);
  if (required <= 0) return { ok: true };

  const treasuryId = resolveOrgTreasuryContractId(params.org);
  const disbursementContractId = resolveOrgDisbursementContractId(params.org);

  let treasuryBal = 0;
  let disbursementContractBal = 0;

  if (treasuryId) {
    treasuryBal = parseFloat(await getSorobanUsdcBalance(treasuryId)) || 0;
  }
  if (disbursementContractId) {
    disbursementContractBal =
      disbursementContractId === treasuryId
        ? treasuryBal
        : parseFloat(await getSorobanUsdcBalance(disbursementContractId)) || 0;
  }

  const orgCombined =
    treasuryId && disbursementContractId && treasuryId !== disbursementContractId
      ? treasuryBal + disbursementContractBal
      : Math.max(treasuryBal, disbursementContractBal);

  const distributionPk = resolveOrgDistributionPublicKey(params.org);
  let distributionBal: number | null = null;
  if (distributionPk) {
    distributionBal = parseFloat(await getUsdcBalance(distributionPk)) || 0;
  }

  if (distributionBal != null && distributionBal + 1e-9 < required) {
    if (orgCombined + 1e-9 >= required) {
      return {
        ok: false,
        code: "SDP_DISTRIBUTION_UNDERFUNDED",
        error:
          `Your org smart account holds ${orgCombined.toFixed(2)} USDC, but SDP's distribution account ` +
          `(${distributionPk}) only has ${distributionBal.toFixed(2)} USDC. SDP requires at least ${required.toFixed(2)} USDC ` +
          `in the distribution wallet before this batch can start. Use "Fund distribution" on this page, then retry Hotlink or Start payments.`,
        details: {
          required,
          orgBalance: orgCombined,
          distributionBalance: distributionBal,
        },
      };
    }

    return {
      ok: false,
      code: "INSUFFICIENT_FUNDS",
      error:
        `Insufficient USDC to start this batch (needs ${required.toFixed(2)} USDC). ` +
        `Org smart account: ${orgCombined.toFixed(2)} USDC. SDP distribution: ${distributionBal.toFixed(2)} USDC.`,
      details: {
        required,
        orgBalance: orgCombined,
        distributionBalance: distributionBal,
      },
    };
  }

  if (orgCombined + 1e-9 < required) {
    return {
      ok: false,
      code: "INSUFFICIENT_ORG_BALANCE",
      error:
        `Org treasury has ${orgCombined.toFixed(2)} USDC but this batch requires ${required.toFixed(2)} USDC. ` +
        `Deposit USDC to your org smart account before starting payments.`,
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

/** Turn raw SDP PATCH /status errors into dashboard-friendly messages. */
export function formatSdpStartError(raw: string): { code: string; error: string } {
  const text = raw.trim();
  if (/insufficient.*balance|409.*balance/i.test(text)) {
    const amountMatch = text.match(/at least ([\d.]+)/i);
    const distMatch = text.match(/distribution account \(([^)]+)\)/i);
    const required = amountMatch?.[1] ?? "?";
    const dist = distMatch?.[1]?.replace(/^stellar:/i, "") ?? "SDP distribution account";
    return {
      code: "SDP_DISTRIBUTION_UNDERFUNDED",
      error:
        `SDP distribution account (${dist}) does not have enough USDC for this batch (needs at least ${required} USDC). ` +
        `Use "Fund distribution" on the Disbursements page, then open a new passkey authorization and retry.`,
    };
  }
  if (/not ready to be started/i.test(text)) {
    return {
      code: "ALREADY_STARTED",
      error:
        "This batch is already started. Use Distribuir to authorize payout release — SDP processes registered beneficiaries automatically when the distribution wallet is funded.",
    };
  }
  if (/409/.test(text)) {
    return { code: "SDP_CONFLICT", error: text.replace(/^SDP PATCH[^\n]*→\s*409:\s*/i, "").slice(0, 400) };
  }
  return { code: "SDP_START_FAILED", error: text.length > 400 ? `${text.slice(0, 400)}…` : text };
}
