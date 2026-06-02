import "server-only";

import {
  Address,
  Asset,
  Contract,
  Keypair,
  Operation,
  TransactionBuilder,
  rpc,
  xdr,
} from "@stellar/stellar-sdk";
import type { Organization } from "@/lib/db/organizations";
import { getHorizon } from "@/lib/stellar/server";
import { getUsdcBalance, getUsdcIssuer } from "@/lib/stellar/balance";
import { getSorobanUsdcBalance } from "@/lib/stellar/soroban-balance";
import {
  getSorobanUsdcTokenId,
  resolveOrgDisbursementContractId,
  resolveOrgTreasuryContractId,
  submitSignedSorobanEnvelope,
} from "@/lib/stellar/org-treasury";
import { amountToI128, getNetworkPassphrase, getSorobanRpcUrl } from "@/lib/stellar/soroban-common";
import {
  readDistributionPublicKey,
  readDistributionSecret,
} from "@/lib/sdp/distributionAccount";
import { PayoutFundsError } from "@/lib/stellar/soroban-payout-errors";

function isPublicNetwork(): boolean {
  return process.env.STELLAR_NETWORK === "public";
}

function getFunderKeypair(): Keypair {
  const secret = process.env.STELLAR_FUNDER_SECRET?.trim();
  if (!secret) throw new Error("STELLAR_FUNDER_SECRET is not configured.");
  return Keypair.fromSecret(secret);
}

function i128ScValFromAmount(amount: string): xdr.ScVal {
  const raw = amountToI128(amount);
  const negative = raw < BigInt(0);
  const abs = negative ? -raw : raw;
  const lo = abs & BigInt("0xffffffffffffffff");
  const hi = abs >> BigInt(64);
  return xdr.ScVal.scvI128(
    new xdr.Int128Parts({
      lo: lo as unknown as xdr.Uint64,
      hi: hi as unknown as xdr.Int64,
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

async function resolveTransferSource(params: {
  org: Organization;
  amountNum: number;
}): Promise<{ sourceContractId: string; sweepFromTreasury: string | null }> {
  const treasuryId = resolveOrgTreasuryContractId(params.org);
  const disbursementId = resolveOrgDisbursementContractId(params.org);

  if (!treasuryId && !disbursementId) {
    throw new Error("Organization has no Soroban treasury or disbursement contract.");
  }

  const treasuryBal = treasuryId ? parseFloat(await getSorobanUsdcBalance(treasuryId)) || 0 : 0;
  const disbursementBal =
    disbursementId && disbursementId !== treasuryId
      ? parseFloat(await getSorobanUsdcBalance(disbursementId)) || 0
      : treasuryBal;

  const primary = disbursementId ?? treasuryId!;
  const secondary = treasuryId && disbursementId && treasuryId !== disbursementId ? treasuryId : null;

  if (disbursementBal + 1e-9 >= params.amountNum) {
    return { sourceContractId: primary, sweepFromTreasury: null };
  }

  if (secondary && treasuryBal + disbursementBal + 1e-9 >= params.amountNum) {
    const sweep = (params.amountNum - disbursementBal).toFixed(7).replace(/\.?0+$/, "");
    return { sourceContractId: primary, sweepFromTreasury: sweep };
  }

  if (treasuryId && treasuryBal + 1e-9 >= params.amountNum && !disbursementId) {
    return { sourceContractId: treasuryId, sweepFromTreasury: null };
  }

  throw new PayoutFundsError({
    message: `Org Soroban wallets hold ${(treasuryBal + (disbursementId && disbursementId !== treasuryId ? disbursementBal : 0)).toFixed(2)} USDC but transfer requires ${params.amountNum} USDC.`,
    disbursementBalance: disbursementBal.toFixed(7),
    requestedAmount: String(params.amountNum),
    treasuryBalance: treasuryBal.toFixed(7),
  });
}

/**
 * Build unsigned Soroban tx: org treasury/disbursement C → SDP distribution G.
 * Admin passkey signs Soroban auth entries on the client.
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
  sourceContractId: string;
  distributionPublicKey: string;
  amount: string;
}> {
  const distribution = (params.distributionPublicKey ?? readDistributionPublicKey()).trim().toUpperCase();
  if (!distribution.startsWith("G")) {
    throw new Error("SDP distribution public key is not configured or invalid.");
  }

  const caller = params.callerSmartAccountId.trim().toUpperCase();
  if (!caller.startsWith("C")) {
    throw new Error("Caller must be a Soroban smart account (C…).");
  }

  const amountNum = parseFloat(params.amount);
  if (!Number.isFinite(amountNum) || amountNum <= 0) {
    throw new Error(`Invalid amount: ${params.amount}`);
  }

  const { sourceContractId, sweepFromTreasury } = await resolveTransferSource({
    org: params.org,
    amountNum,
  });

  const treasuryId = resolveOrgTreasuryContractId(params.org);
  const funder = getFunderKeypair();
  const rpcUrl = getSorobanRpcUrl();
  const server = new rpc.Server(rpcUrl, { allowHttp: rpcUrl.startsWith("http://") });
  const networkPassphrase = getNetworkPassphrase();
  const tokenId = getSorobanUsdcTokenId();
  const token = new Contract(tokenId);

  const account = await server.getAccount(funder.publicKey());
  const builder = new TransactionBuilder(account, {
    fee: "100000",
    networkPassphrase,
  }).setTimeout(60);

  if (sweepFromTreasury && treasuryId) {
    builder.addOperation(
      token.call(
        "transfer",
        Address.fromString(treasuryId).toScVal(),
        Address.fromString(sourceContractId).toScVal(),
        i128ScValFromAmount(sweepFromTreasury)
      )
    );
  }

  builder.addOperation(
    token.call(
      "transfer",
      Address.fromString(sourceContractId).toScVal(),
      Address.fromString(distribution).toScVal(),
      i128ScValFromAmount(params.amount)
    )
  );

  const prepared = await server.prepareTransaction(builder.build());

  return {
    envelopeXdr: prepared.toEnvelope().toXDR("base64"),
    network: isPublicNetwork() ? "public" : "testnet",
    feePayerPublicKey: funder.publicKey(),
    sourceContractId,
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
