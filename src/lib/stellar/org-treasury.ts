/**
 * Org treasury: disbursement contract bootstrap, USDC migration, unsigned Soroban payout prep.
 * Server-only.
 */
import {
  Address,
  Contract,
  Keypair,
  TransactionBuilder,
  rpc,
  xdr,
  Operation,
  Asset,
  Networks,
} from "@stellar/stellar-sdk";
import { getHorizon } from "@/lib/stellar/server";
import { decryptOrgSecret } from "@/lib/org-secret";
import { isUserDerivedEncrypted } from "@/lib/org-wallet-encryption";
import { amountToI128, coerceSimulateRetval, getNetworkPassphrase, getSorobanRpcUrl } from "@/lib/stellar/soroban-common";
import { getSorobanUsdcBalance } from "@/lib/stellar/soroban-balance";
import { PayoutFundsError, formatSorobanPayoutError } from "@/lib/stellar/soroban-payout-errors";
import type { Organization } from "@/lib/db/organizations";

const USDC_ISSUER_TESTNET =
  "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";
const USDC_ISSUER_PUBLIC =
  "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4EZN";

function isPublicNetwork(): boolean {
  return process.env.STELLAR_NETWORK === "public";
}

function getUsdcIssuer(): string {
  return isPublicNetwork() ? USDC_ISSUER_PUBLIC : USDC_ISSUER_TESTNET;
}

/** Circle USDC SAC on Stellar testnet — contractId-first (same issuer as SozuCredit registry). */
function defaultTestnetSacContractId(): string {
  const issuer =
    process.env.CIRCLE_TESTNET_USDC_ISSUER?.trim() ||
    USDC_ISSUER_TESTNET;
  return new Asset("USDC", issuer).contractId(Networks.TESTNET);
}

export function getSorobanUsdcTokenId(): string {
  const fromEnv = process.env.SOROBAN_USDC_TOKEN_ID?.trim();
  if (fromEnv) return fromEnv;
  if (!isPublicNetwork()) return defaultTestnetSacContractId();
  throw new Error(
    "SOROBAN_USDC_TOKEN_ID is required for Soroban treasury operations on mainnet."
  );
}

/** Primary on-chain disbursement target for an org. */
export function resolveOrgDisbursementContractId(org: Organization): string | null {
  return org.soroban_contract_id?.trim() || null;
}

/**
 * Primary treasury receive address (donations/deposits) for an org.
 * Prefer `treasury_contract_id` when present; fall back to disbursement contract.
 */
export function resolveOrgTreasuryContractId(org: Organization): string | null {
  return org.treasury_contract_id?.trim() || resolveOrgDisbursementContractId(org);
}

export function orgTreasuryMigrationStatus(org: Organization): {
  hasClassicWallet: boolean;
  hasDisbursementContract: boolean;
  hasTreasurySmartAccount: boolean;
  readyForPasskeyPayouts: boolean;
} {
  const hasClassicWallet = !!org.stellar_disbursement_public_key;
  const hasDisbursementContract = !!org.soroban_contract_id;
  const hasTreasurySmartAccount = !!org.treasury_contract_id;
  return {
    hasClassicWallet,
    hasDisbursementContract,
    hasTreasurySmartAccount,
    readyForPasskeyPayouts: hasDisbursementContract,
  };
}

function getFunderKeypair(): Keypair {
  const secret = process.env.STELLAR_FUNDER_SECRET?.trim();
  if (!secret) throw new Error("STELLAR_FUNDER_SECRET is not configured.");
  return Keypair.fromSecret(secret);
}

function getOrgClassicSecret(orgId: string, encrypted: string): Keypair {
  if (isUserDerivedEncrypted(encrypted)) {
    throw new Error(
      "Classic wallet uses payout-password encryption. Decrypt client-side and submit a signed migration transaction."
    );
  }
  return Keypair.fromSecret(decryptOrgSecret(orgId, encrypted));
}

/**
 * Initialize disbursement_wallet with member smart account as the sole authorized signer.
 */
export async function initializeDisbursementContract(params: {
  contractId: string;
  memberSmartAccountContractId: string;
}): Promise<string> {
  const funder = getFunderKeypair();
  const rpcUrl = getSorobanRpcUrl();
  const server = new rpc.Server(rpcUrl, { allowHttp: rpcUrl.startsWith("http://") });
  const networkPassphrase = getNetworkPassphrase();
  const tokenId = getSorobanUsdcTokenId();

  const account = await server.getAccount(funder.publicKey());
  const contract = new Contract(params.contractId);

  const tokenScVal = Address.fromString(tokenId).toScVal();
  const signerScVal = Address.fromString(params.memberSmartAccountContractId).toScVal();
  const signersVec = xdr.ScVal.scvVec([signerScVal]);

  const op = contract.call("initialize", tokenScVal, signersVec);

  const rawTx = new TransactionBuilder(account, {
    fee: "100000",
    networkPassphrase,
  })
    .addOperation(op)
    .setTimeout(60)
    .build();

  const prepared = await server.prepareTransaction(rawTx);
  prepared.sign(funder);
  const result = await server.sendTransaction(prepared);
  if (result.status === "ERROR") {
    throw new Error(`initialize failed: ${String(result.errorResult)}`);
  }
  if (!result.hash) throw new Error("initialize: no transaction hash");
  return result.hash;
}

/**
 * Check whether an address is an authorized signer on the disbursement contract.
 */
export async function isDisbursementSigner(
  contractId: string,
  address: string
): Promise<boolean> {
  const funder = getFunderKeypair();
  const rpcUrl = getSorobanRpcUrl();
  const server = new rpc.Server(rpcUrl, { allowHttp: rpcUrl.startsWith("http://") });
  const networkPassphrase = getNetworkPassphrase();

  const account = await server.getAccount(funder.publicKey());
  const contract = new Contract(contractId);
  const addrScVal = Address.fromString(address).toScVal();
  const op = contract.call("is_signer", addrScVal);

  const rawTx = new TransactionBuilder(account, {
    fee: "100",
    networkPassphrase,
  })
    .addOperation(op)
    .setTimeout(30)
    .build();

  const sim = (await server.simulateTransaction(rawTx)) as {
    error?: string;
    result?: { retval?: unknown };
  };
  if (sim.error) return false;
  const retval = coerceSimulateRetval(sim.result?.retval);
  if (!retval) return false;
  return retval.switch().name === "scvBool" && retval.b() === true;
}

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

/**
 * Fee payer = STELLAR_FUNDER_SECRET G; caller smart account (C) authorizes via Soroban auth.
 * When treasury holds USDC but disbursement does not, prepends a token transfer (treasury → disbursement).
 */
export async function buildUnsignedSorobanPayout(params: {
  disbursementContractId: string;
  callerSmartAccountId: string;
  recipientAddress: string;
  amount: string;
  /** Org receive treasury (C…); USDC here is swept into disbursement before payout when needed. */
  treasuryContractId?: string | null;
}): Promise<{ envelopeXdr: string; network: string; feePayerPublicKey: string }> {
  const caller = params.callerSmartAccountId.trim().toUpperCase();
  const recipient = params.recipientAddress.trim().toUpperCase();
  const disbursement = params.disbursementContractId.trim().toUpperCase();
  const treasury = params.treasuryContractId?.trim().toUpperCase() || null;

  if (!caller.startsWith("C")) {
    throw new Error("Caller must be a Soroban smart account (C…).");
  }
  if (!recipient.startsWith("G") && !recipient.startsWith("C")) {
    throw new Error("Recipient must be a Stellar G or C address.");
  }

  const amountNum = parseFloat(params.amount);
  if (!Number.isFinite(amountNum) || amountNum <= 0) {
    throw new Error(`Invalid amount: ${params.amount}`);
  }

  const disbursementBal = parseFloat(await getSorobanUsdcBalance(disbursement)) || 0;
  let topUpAmount: string | null = null;

  if (disbursementBal + 1e-9 < amountNum) {
    const shortfall = amountNum - disbursementBal;
    if (!treasury || treasury === disbursement) {
      throw new PayoutFundsError({
        message: `Disbursement wallet has ${disbursementBal.toFixed(2)} USDC but payout requires ${amountNum} USDC.`,
        disbursementBalance: disbursementBal.toFixed(7),
        requestedAmount: params.amount,
      });
    }
    const treasuryBal = parseFloat(await getSorobanUsdcBalance(treasury)) || 0;
    if (treasuryBal + disbursementBal + 1e-9 < amountNum) {
      throw new PayoutFundsError({
        message: `Not enough USDC. Disbursement: ${disbursementBal.toFixed(2)}, treasury: ${treasuryBal.toFixed(2)}, requested: ${amountNum} USDC.`,
        disbursementBalance: disbursementBal.toFixed(7),
        requestedAmount: params.amount,
        treasuryBalance: treasuryBal.toFixed(7),
      });
    }
    topUpAmount = shortfall.toFixed(7).replace(/\.?0+$/, "");
  }

  const funder = getFunderKeypair();
  const rpcUrl = getSorobanRpcUrl();
  const server = new rpc.Server(rpcUrl, { allowHttp: rpcUrl.startsWith("http://") });
  const networkPassphrase = getNetworkPassphrase();

  const account = await server.getAccount(funder.publicKey());
  const disbursementContract = new Contract(disbursement);
  const tokenId = getSorobanUsdcTokenId();
  const token = new Contract(tokenId);

  const callerScVal = Address.fromString(caller).toScVal();
  const recipientScVal = Address.fromString(recipient).toScVal();
  const amountScVal = i128ScValFromAmount(params.amount);

  const builder = new TransactionBuilder(account, {
    fee: "100000",
    networkPassphrase,
  }).setTimeout(60);

  if (topUpAmount && treasury) {
    builder.addOperation(
      token.call(
        "transfer",
        Address.fromString(treasury).toScVal(),
        Address.fromString(disbursement).toScVal(),
        i128ScValFromAmount(topUpAmount)
      )
    );
  }

  builder.addOperation(
    disbursementContract.call("payout", callerScVal, recipientScVal, amountScVal)
  );

  const rawTx = builder.build();

  let prepared;
  try {
    prepared = await server.prepareTransaction(rawTx);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("balance is not sufficient") || msg.includes("Error(Contract, #10)")) {
      throw new PayoutFundsError({
        message: formatPrepareFailure(msg, disbursementBal, amountNum),
        disbursementBalance: disbursementBal.toFixed(7),
        requestedAmount: params.amount,
      });
    }
    throw e;
  }

  return {
    envelopeXdr: prepared.toEnvelope().toXDR("base64"),
    network: isPublicNetwork() ? "public" : "testnet",
    feePayerPublicKey: funder.publicKey(),
  };
}

function formatPrepareFailure(raw: string, disbBal: number, amountNum: number): string {
  if (raw.includes("balance is not sufficient")) {
    return `Disbursement wallet has ${disbBal.toFixed(2)} USDC but payout requires ${amountNum} USDC.`;
  }
  return raw.slice(0, 240);
}

/**
 * Submit a passkey-signed Soroban transaction envelope.
 */
export async function submitSignedSorobanEnvelope(
  signedEnvelopeXdr: string,
  locale: import("@/lib/i18n/locale").SupportedLocale = "es"
): Promise<string> {
  const rpcUrl = getSorobanRpcUrl();
  const server = new rpc.Server(rpcUrl, { allowHttp: rpcUrl.startsWith("http://") });
  const networkPassphrase = getNetworkPassphrase();
  const { Transaction, TransactionBuilder, FeeBumpTransaction } = await import("@stellar/stellar-sdk");
  const { Api } = await import("@stellar/stellar-sdk/rpc");

  const parsed = TransactionBuilder.fromXDR(signedEnvelopeXdr, networkPassphrase);
  if (!(parsed instanceof Transaction) && !(parsed instanceof FeeBumpTransaction)) {
    throw new Error("Could not parse signed envelope XDR into a Transaction.");
  }
  const tx = parsed;

  let preparedTx = tx;
  try {
    if (tx instanceof Transaction) {
      preparedTx = await server.prepareTransaction(tx);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(formatSorobanPayoutError(msg, locale));
  }

  const sim = await server.simulateTransaction(preparedTx);
  if (Api.isSimulationError(sim)) {
    const detail = typeof sim.error === "string" ? sim.error : JSON.stringify(sim.error);
    throw new Error(formatSorobanPayoutError(detail, locale));
  }

  const funder = getFunderKeypair();
  const txSource =
    preparedTx instanceof FeeBumpTransaction
      ? (preparedTx as { innerTransaction?: { source?: string } }).innerTransaction?.source ?? ""
      : preparedTx.source;
  if (funder.publicKey() === txSource && preparedTx instanceof Transaction) {
    preparedTx.sign(funder);
  }

  const result = await server.sendTransaction(preparedTx);
  if (result.status === "ERROR") {
    throw new Error(formatSorobanPayoutError(String(result.errorResult ?? "Soroban submit failed"), locale));
  }
  if (!result.hash) throw new Error("No transaction hash from Soroban RPC");
  return result.hash;
}

/**
 * Migrate USDC from classic org G wallet to disbursement contract via payment (classic path).
 * MVP testnet: uses server-decrypted org G secret.
 */
export async function migrateClassicUsdcToDisbursementContract(params: {
  orgId: string;
  org: Organization;
  disbursementContractId: string;
  amount: string;
}): Promise<string> {
  if (isPublicNetwork()) {
    throw new Error("Classic-to-contract USDC migration via server secret is disabled on mainnet.");
  }
  const gPub = params.org.stellar_disbursement_public_key;
  const enc = params.org.stellar_disbursement_secret_encrypted;
  if (!gPub || !enc) {
    throw new Error("Organization has no classic disbursement wallet to migrate from.");
  }

  const source = getOrgClassicSecret(params.orgId, enc);
  if (source.publicKey() !== gPub) {
    throw new Error("Org wallet secret does not match public key.");
  }

  const horizon = getHorizon();
  const issuer = getUsdcIssuer();
  const account = await horizon.loadAccount(source.publicKey());

  const tx = new TransactionBuilder(account, {
    fee: "100000",
    networkPassphrase: getNetworkPassphrase(),
  })
    .addOperation(
      Operation.payment({
        destination: params.disbursementContractId,
        asset: new Asset("USDC", issuer),
        amount: params.amount,
      })
    )
    .setTimeout(60)
    .build();

  tx.sign(source);
  const res = await horizon.submitTransaction(tx);
  return res.hash;
}
