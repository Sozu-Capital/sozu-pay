import "server-only";

import {
  Address,
  Contract,
  Keypair,
  rpc,
  TransactionBuilder,
  xdr,
} from "@stellar/stellar-sdk";
import type { Organization } from "@/lib/db/organizations";
import { getUsdcBalance } from "@/lib/stellar/balance";
import { getSorobanUsdcBalance } from "@/lib/stellar/soroban-balance";
import {
  buildUnsignedSorobanPayout,
  getSorobanUsdcTokenId,
  resolveOrgDisbursementContractId,
  resolveOrgTreasuryContractId,
  submitSignedSorobanEnvelope,
} from "@/lib/stellar/org-treasury";
import {
  amountToI128,
  getNetworkPassphrase,
  getSorobanRpcUrl,
} from "@/lib/stellar/soroban-common";
import {
  readDistributionPublicKey,
  readDistributionSecret,
} from "@/lib/sdp/distributionAccount";
import {
  isOrgDistributionConfigured,
  isOrgDistributionSweepBackEnabled,
  resolveOrgDistributionPublicKey,
  resolveOrgDistributionSecret,
} from "@/lib/sdp/org-distribution";
import { PayoutFundsError } from "@/lib/stellar/soroban-payout-errors";

function i128ScValFromAmount(amount: string): xdr.ScVal {
  const amountI128 = amountToI128(amount);
  const mask64 = BigInt("0xffffffffffffffff");
  const lo = amountI128 & mask64;
  const hi = amountI128 >> BigInt(64);
  return xdr.ScVal.scvI128(
    new xdr.Int128Parts({
      lo: lo as unknown as xdr.Uint64,
      hi: hi as unknown as xdr.Uint64,
    })
  );
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
  const distributionPublicKey = resolveOrgDistributionPublicKey(org);

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
    sweepBackEnabled: isOrgDistributionSweepBackEnabled(org),
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
  const distributionRaw =
    params.distributionPublicKey ?? resolveOrgDistributionPublicKey(params.org);
  const distribution = (distributionRaw ?? "").trim().toUpperCase();
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

/** Soroban SAC transfer: org distribution G → org treasury C (server-signed). */
export async function transferDistributionToTreasury(params: {
  org: Organization;
  amount: string;
  treasuryContractId: string;
}): Promise<string> {
  const secret = resolveOrgDistributionSecret(params.org);
  if (!secret) {
    throw new Error(
      "Distribution sweep-back is not configured for this organization."
    );
  }

  const distributionPk = resolveOrgDistributionPublicKey(params.org);
  if (!distributionPk) {
    throw new Error("Organization distribution public key is not configured.");
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

  const rpcUrl = getSorobanRpcUrl();
  const server = new rpc.Server(rpcUrl, { allowHttp: rpcUrl.startsWith("http://") });
  const networkPassphrase = getNetworkPassphrase();
  const token = new Contract(getSorobanUsdcTokenId());

  const account = await server.getAccount(source.publicKey());
  const rawTx = new TransactionBuilder(account, {
    fee: "100000",
    networkPassphrase,
  })
    .addOperation(
      token.call(
        "transfer",
        Address.fromString(source.publicKey()).toScVal(),
        Address.fromString(treasury).toScVal(),
        i128ScValFromAmount(params.amount)
      )
    )
    .setTimeout(60)
    .build();

  let prepared;
  try {
    prepared = await server.prepareTransaction(rawTx);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/insufficient/i.test(msg)) {
      throw new PayoutFundsError({
        message: `SDP distribution account has ${distributionBal.toFixed(2)} USDC but sweep requires ${amountNum} USDC.`,
        disbursementBalance: distributionBal.toFixed(7),
        requestedAmount: params.amount,
      });
    }
    throw new Error(
      msg.includes("destination") || msg.includes("Invalid")
        ? `Could not sweep to treasury contract ${treasury.slice(0, 8)}… — ${msg}`
        : msg
    );
  }

  prepared.sign(source);
  const result = await server.sendTransaction(prepared);
  if (result.status === "ERROR") {
    const detail = String(result.errorResult ?? "Soroban submit failed");
    throw new Error(
      /destination/i.test(detail)
        ? `Treasury contract ${treasury.slice(0, 8)}… cannot receive this transfer. Confirm treasury_contract_id is your org Soroban smart account (C…).`
        : detail
    );
  }
  if (!result.hash) throw new Error("No transaction hash from Soroban RPC");
  return result.hash;
}

export { submitSignedSorobanEnvelope };
