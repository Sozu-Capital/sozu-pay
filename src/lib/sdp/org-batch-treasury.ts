import type { Organization } from "@/lib/db/organizations";
import { usableClassicTreasuryPublicKey } from "@/lib/pollar/types";

export type OrgBatchTreasuryHolders = {
  /** Distinct Soroban C addresses that can hold org USDC. */
  contractIds: string[];
  /** Classic G treasury (Pollar / NGO), excluding the fake-auth sentinel. */
  classicG: string | null;
};

function addContractId(ids: Set<string>, value: string | null | undefined) {
  const id = value?.trim();
  if (id?.startsWith("C")) ids.add(id);
}

/**
 * Addresses the org can pay a batch from: Soroban C contracts and/or Pollar classic G.
 * Passkey orgs typically have C; Google/Pollar orgs typically have only G.
 */
export function collectOrgBatchTreasuryHolders(
  org: Organization
): OrgBatchTreasuryHolders {
  const contractIds = new Set<string>();
  addContractId(contractIds, org.treasury_contract_id);
  addContractId(contractIds, org.soroban_contract_id);
  addContractId(contractIds, org.treasury_smart_account_address);
  return {
    contractIds: [...contractIds],
    classicG: usableClassicTreasuryPublicKey(org.stellar_disbursement_public_key),
  };
}

export function orgHasBatchPaymentTreasury(org: Organization): boolean {
  const holders = collectOrgBatchTreasuryHolders(org);
  return holders.contractIds.length > 0 || holders.classicG != null;
}
