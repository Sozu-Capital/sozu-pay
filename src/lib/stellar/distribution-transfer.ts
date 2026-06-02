import "server-only";

import { Asset, Keypair, Operation, TransactionBuilder } from "@stellar/stellar-sdk";
import type { Organization } from "@/lib/db/organizations";
import { getHorizon } from "@/lib/stellar/server";
import { getUsdcBalance, getUsdcIssuer } from "@/lib/stellar/balance";
import { getSorobanUsdcBalance } from "@/lib/stellar/soroban-balance";
import {
  buildUnsignedSorobanPayout,
  resolveOrgDisbursementContractId,
  resolveOrgTreasuryContractId,
  submitSignedSorobanEnvelope,
} from "@/lib/stellar/org-treasury";
import { getNetworkPassphrase } from "@/lib/stellar/soroban-common";
import {
  readDistributionPublicKey,
  readDistributionSecret,
} from "@/lib/sdp/distributionAccount";
import { PayoutFundsError } from "@/lib/stellar/soroban-payout-errors";

function isPublicNetwork(): boolean {
  return process.env.STELLAR_NETWORK === "public";
}

export type DistributionBalances = {
  treasuryContractId: string | null;
  disbursementContractId: string | null;
  orgCombinedUsdc: string;
  treasuryUsdc: string;
  disbursementUsdc: string;
  distributionPublicKey: string | null;
  distributionUsdc: string;
  sweepBackEnabled: boolean;
};

export async function fetchDistributionBalances(org: Organization): Promise<DistributionBalances> {
  const treasuryContractId = resolveOrgTreasuryContractId(org);
  const disbursementContractId = resolveOrgDisbursementContractId(org);
  const distributionPublicKey = readDistributionPublicKey() || null;

  let treasuryUsdc = "0";
  let disbursementUsdc = "0";

  if (treasuryContractId) {
    treasuryUsdc = await getSorobanUsdcBalance(treasuryContractId);
  }
  if (disbursementContractId && disbursementContractId !== treasuryContractId) {
    disbursementUsdc = await getSorobanUsdcBalance(disbursementContractId);
  } else if (disbursementContractId) {
    disbursementUsdc = treasuryUsdc;
  }

  const orgCombined =
    treasuryContractId && disbursementContractId && treasuryContractId !== disbursementContractId
      ? (parseFloat(treasuryUsdc) + parseFloat(disbursementUsdc)).toFixed(7)
      : treasuryUsdc;

  let distributionUsdc = "0";
  if (distributionPublicKey) {
    distributionUsdc = await getUsdcBalance(distributionPublicKey);
  }

  return {
    treasuryContractId,
    disbursementContractId,
    orgCombinedUsdc: orgCombined.replace(/\.?0+$/, "") || "0",
    treasuryUsdc,
    disbursementUsdc,
    distributionPublicKey,
    distributionUsdc,
    sweepBackEnabled: Boolean(distributionPublicKey && readDistributionSecret()),
  };
}

/**
 * Fund SDP distribution via disbursement_wallet.payout (member passkey signs).
 * Sweeps treasury → disbursement in the same tx when needed (may require a second passkey prompt for treasury C).
 */
export async function buildUnsignedTreasuryToDistributionTransfer(params: {
  org: Organization;
  callerSmartAccountId: string;
  amount: string;
  distributionPublicKey?: string;
}): Promise<{
  envelopeXdr: string;
  network: string;
  feePayerPublicKey: string;
  disbursementContractId: string;
  treasuryContractId: string | null;
  distributionPublicKey: string;
  amount: string;
}> {
  const distribution = (params.distributionPublicKey ?? readDistributionPublicKey()).trim().toUpperCase();
  if (!distribution.startsWith("G")) {
    throw new Error("SDP distribution public key is not configured or invalid.");
  }

  const disbursementContractId = resolveOrgDisbursementContractId(params.org);
  if (!disbursementContractId) {
    throw new Error("Organization has no Soroban disbursement contract.");
  }

  const prepared = await buildUnsignedSorobanPayout({
    disbursementContractId,
    callerSmartAccountId: params.callerSmartAccountId,
    recipientAddress: distribution,
    amount: params.amount,
    treasuryContractId: resolveOrgTreasuryContractId(params.org),
  });

  return {
    envelopeXdr: prepared.envelopeXdr,
    network: prepared.network,
    feePayerPublicKey: prepared.feePayerPublicKey,
    disbursementContractId,
    treasuryContractId: resolveOrgTreasuryContractId(params.org),
    distributionPublicKey: distribution,
    amount: params.amount,
  };
}

/** Classic USDC payment: SDP distribution G → org treasury C (server-signed). */
export async function transferDistributionToTreasury(params: {
  amount: string;
  treasuryContractId: string;
}): Promise<string> {
  const secret = readDistributionSecret();
  if (!secret) {
    throw new Error(
      "Distribution sweep-back is not configured. Set SDP_DISTRIBUTION_SEED on the server."
    );
  }

  const distributionPk = readDistributionPublicKey();
  if (!distributionPk) {
    throw new Error("SDP distribution public key is not configured.");
  }

  const amountNum = parseFloat(params.amount);
  if (!Number.isFinite(amountNum) || amountNum <= 0) {
    throw new Error(`Invalid amount: ${params.amount}`);
  }

  const distributionBal = parseFloat(await getUsdcBalance(distributionPk)) || 0;
  if (distributionBal + 1e-9 < amountNum) {
    throw new PayoutFundsError({
      message: `SDP distribution account has ${distributionBal.toFixed(2)} USDC but sweep requires ${amountNum} USDC.`,
      disbursementBalance: distributionBal.toFixed(7),
      requestedAmount: params.amount,
    });
  }

  const treasury = params.treasuryContractId.trim().toUpperCase();
  if (!treasury.startsWith("C")) {
    throw new Error("Treasury destination must be a Soroban contract (C…).");
  }

  const source = Keypair.fromSecret(secret);
  if (source.publicKey() !== distributionPk) {
    throw new Error("Distribution secret does not match configured public key.");
  }

  const horizon = getHorizon();
  const account = await horizon.loadAccount(source.publicKey());
  const tx = new TransactionBuilder(account, {
    fee: "100000",
    networkPassphrase: getNetworkPassphrase(),
  })
    .addOperation(
      Operation.payment({
        destination: treasury,
        asset: new Asset("USDC", getUsdcIssuer()),
        amount: params.amount,
      })
    )
    .setTimeout(60)
    .build();

  tx.sign(source);
  const res = await horizon.submitTransaction(tx);
  return res.hash;
}

export { submitSignedSorobanEnvelope };
