import "server-only";

import type { Organization } from "@/lib/db/organizations";
import {
  isValidStellarReceiveAddress,
  normalizeStellarAddressInput,
} from "@/lib/payment/stellar-address";
import {
  buildUnsignedSorobanPayout,
  resolveOrgDisbursementContractId,
  resolveOrgTreasuryContractId,
} from "@/lib/stellar/org-treasury";

function resolveOffRampTreasuryFromEnv(): string | null {
  for (const key of ["SOZU_OFF_RAMP_TREASURY_ADDRESS", "SOZU_TREASURY_STELLAR_ADDRESS"] as const) {
    const raw = process.env[key]?.trim();
    if (!raw) continue;
    const normalized = normalizeStellarAddressInput(raw);
    if (!isValidStellarReceiveAddress(normalized)) {
      throw new Error(
        `${key} must be a valid Stellar G (classic) or C (Soroban smart account) address.`,
      );
    }
    return normalized;
  }
  return null;
}

/** Sozu treasury that receives USDC when merchants off-ramp (CLP already sent by ops). */
export function getOffRampTreasuryAddress(): string {
  const address = resolveOffRampTreasuryFromEnv();
  if (address) return address;

  throw new Error(
    "Off-ramp treasury not configured. Set SOZU_OFF_RAMP_TREASURY_ADDRESS to a G or C address (smart account OK).",
  );
}

export async function prepareOffRampUsdcRelease(params: {
  org: Organization;
  callerSmartAccountId: string;
  amountUsd: string;
}) {
  const destination = getOffRampTreasuryAddress();
  const disbursementContractId = resolveOrgDisbursementContractId(params.org);
  if (!disbursementContractId) {
    throw new Error(
      "Your organization needs a Soroban smart wallet to release USDC. Set up treasury in Profile.",
    );
  }

  const prepared = await buildUnsignedSorobanPayout({
    disbursementContractId,
    callerSmartAccountId: params.callerSmartAccountId,
    recipientAddress: destination,
    amount: params.amountUsd,
    treasuryContractId: resolveOrgTreasuryContractId(params.org),
  });

  return {
    ...prepared,
    destinationAddress: destination,
    amountUsd: params.amountUsd,
  };
}
