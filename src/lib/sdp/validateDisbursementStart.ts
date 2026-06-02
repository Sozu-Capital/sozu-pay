import "server-only";

import type { Organization } from "@/lib/db/organizations";
import {
  resolveOrgDisbursementContractId,
  resolveOrgTreasuryContractId,
} from "@/lib/stellar/org-treasury";
import { getUsdcBalance } from "@/lib/stellar/balance";
import { getSorobanUsdcBalance } from "@/lib/stellar/soroban-balance";
import { readDistributionPublicKey } from "@/lib/sdp/distributionAccount";
import type { SdpDisbursement, SdpReceiver } from "@/lib/sdp/adminClient";
import { deriveBeneficiaryLifecycleState } from "@/lib/sdp/receiverDisplay";

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

/** Block start/hotlink when every recipient is still pre-invite (lifecycle draft). */
export function validateBeneficiariesReady(
  receivers: SdpReceiver[]
): DisbursementPreflightResult {
  if (receivers.length === 0) {
    return {
      ok: false,
      code: "NO_RECEIVERS",
      error:
        "This batch has no recipients. Add beneficiaries before starting payments or Hotlink.",
    };
  }

  const draftCount = receivers.filter(
    (r) => deriveBeneficiaryLifecycleState(r) === "draft"
  ).length;

  if (draftCount === receivers.length) {
    return {
      ok: false,
      code: "BENEFICIARIES_NOT_READY",
      error:
        receivers.length === 1
          ? "The recipient is still in draft — send the invite email first so they can register in SozuCredit. Starting payouts is blocked until at least one invite has been sent."
          : "All recipients are still in draft — send invite emails first. Starting payouts is blocked until at least one recipient has received a registration link.",
      details: { recipientCount: receivers.length, draftCount },
    };
  }

  return { ok: true };
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

  const distributionPk = readDistributionPublicKey();
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
          `in the distribution wallet before this batch can start. Fund the SDP distribution account, then retry.`,
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
}): Promise<DisbursementPreflightResult> {
  const beneficiaries = validateBeneficiariesReady(params.receivers);
  if (!beneficiaries.ok) return beneficiaries;
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
        `Fund the SDP distribution wallet on Stellar, then open a new passkey authorization and retry.`,
    };
  }
  if (/409/.test(text)) {
    return { code: "SDP_CONFLICT", error: text.replace(/^SDP PATCH[^\n]*→\s*409:\s*/i, "").slice(0, 400) };
  }
  return { code: "SDP_START_FAILED", error: text.length > 400 ? `${text.slice(0, 400)}…` : text };
}
