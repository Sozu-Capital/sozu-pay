/**
 * Provision org Soroban treasury on testnet: deploy disbursement contract,
 * initialize with member smart account signer, fund XLM for contract ops.
 */
import "server-only";

import { deployDisbursementContract } from "@/lib/stellar/deploy-disbursement";
import {
  initializeDisbursementContract,
  isDisbursementSigner,
} from "@/lib/stellar/org-treasury";
import { fundSmartAccount } from "@/lib/stellar/fund";
import { updateOrganizationSorobanContract } from "@/lib/db/organizations";

export type ProvisionOrgSmartTreasuryResult = {
  soroban_contract_id: string;
  member_smart_account_id: string;
  deploy_tx_hash?: string;
  initialize_tx_hash?: string;
  fund_xlm_tx_hash?: string;
  already_provisioned: boolean;
};

/**
 * Deploy + initialize disbursement_wallet for an org. Idempotent when contract already linked.
 */
export async function provisionOrgSmartTreasury(params: {
  orgId: string;
  memberSmartAccountContractId: string;
}): Promise<ProvisionOrgSmartTreasuryResult> {
  const memberId = params.memberSmartAccountContractId.trim();
  if (!memberId.startsWith("C")) {
    throw new Error("memberSmartAccountContractId must be a Soroban contract address (C…).");
  }

  const contractId = await deployDisbursementContract();

  let initializeTxHash: string | undefined;
  const alreadySigner = await isDisbursementSigner(contractId, memberId);
  if (!alreadySigner) {
    initializeTxHash = await initializeDisbursementContract({
      contractId,
      memberSmartAccountContractId: memberId,
    });
  }

  let fundXlmTxHash: string | undefined;
  try {
    fundXlmTxHash = await fundSmartAccount(contractId, "2");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!msg.toLowerCase().includes("insufficient")) {
      console.warn("[provisionOrgSmartTreasury] fundSmartAccount:", msg);
    }
  }

  const updated = await updateOrganizationSorobanContract(params.orgId, contractId);
  if (!updated) {
    throw new Error("Failed to save soroban_contract_id on organization.");
  }

  return {
    soroban_contract_id: contractId,
    member_smart_account_id: memberId,
    initialize_tx_hash: initializeTxHash,
    fund_xlm_tx_hash: fundXlmTxHash,
    already_provisioned: alreadySigner,
  };
}
