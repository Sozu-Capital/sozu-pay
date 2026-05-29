/**
 * Org treasury: disbursement contract bootstrap, USDC migration, unsigned Soroban payout prep.
 * Server-only.
 */
import {
  Address,
  Contract,
  Keypair,
  TransactionBuilder,
  Networks,
  rpc,
  xdr,
  Operation,
  Asset,
} from "@stellar/stellar-sdk";
import { getHorizon } from "@/lib/stellar/server";
import { decryptOrgSecret } from "@/lib/org-secret";
import { isUserDerivedEncrypted } from "@/lib/org-wallet-encryption";
import { amountToI128, getNetworkPassphrase, getSorobanRpcUrl } from "@/lib/stellar/soroban-common";
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

export function getSorobanUsdcTokenId(): string {
  const fromEnv = process.env.SOROBAN_USDC_TOKEN_ID?.trim();
  if (fromEnv) return fromEnv;
  throw new Error(
    "SOROBAN_USDC_TOKEN_ID is required for Soroban treasury operations. Set it in env (USDC SAC contract ID on testnet/mainnet)."
  );
}

/** Primary on-chain disbursement target for an org. */
export function resolveOrgDisbursementContractId(org: Organization): string | null {
  return org.soroban_contract_id?.trim() || null;
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
    result?: { retval?: string };
  };
  if (sim.error) return false;
  if (!sim.result?.retval) return false;
  const retval = xdr.ScVal.fromXDR(sim.result.retval, "base64");
  return retval.switch().name === "scvBool" && retval.b() === true;
}

/**
 * Build an unsigned Soroban payout tx for passkey signing.
 * Source / caller = member smart account C; invokes disbursement_wallet.payout(caller, recipient, amount).
 */
export async function buildUnsignedSorobanPayout(params: {
  disbursementContractId: string;
  callerSmartAccountId: string;
  recipientAddress: string;
  amount: string;
}): Promise<{ envelopeXdr: string; network: string }> {
  const rpcUrl = getSorobanRpcUrl();
  const server = new rpc.Server(rpcUrl, { allowHttp: rpcUrl.startsWith("http://") });
  const networkPassphrase = getNetworkPassphrase();

  const account = await server.getAccount(params.callerSmartAccountId);
  const contract = new Contract(params.disbursementContractId);
  const amountI128 = amountToI128(params.amount);

  const callerScVal = Address.fromString(params.callerSmartAccountId).toScVal();
  const recipientScVal = Address.fromString(params.recipientAddress).toScVal();
  const mask64 = BigInt("0xffffffffffffffff");
  const lo = amountI128 & mask64;
  const hi = amountI128 >> BigInt(64);
  const amountScVal = xdr.ScVal.scvI128(
    new xdr.Int128Parts({
      lo: lo as unknown as xdr.Uint64,
      hi: hi as unknown as xdr.Uint64,
    })
  );

  const op = contract.call("payout", callerScVal, recipientScVal, amountScVal);

  const rawTx = new TransactionBuilder(account, {
    fee: "100000",
    networkPassphrase,
  })
    .addOperation(op)
    .setTimeout(60)
    .build();

  const prepared = await server.prepareTransaction(rawTx);
  return {
    envelopeXdr: prepared.toEnvelope().toXDR("base64"),
    network: isPublicNetwork() ? "public" : "testnet",
  };
}

/**
 * Submit a passkey-signed Soroban transaction envelope.
 */
export async function submitSignedSorobanEnvelope(signedEnvelopeXdr: string): Promise<string> {
  const rpcUrl = getSorobanRpcUrl();
  const server = new rpc.Server(rpcUrl, { allowHttp: rpcUrl.startsWith("http://") });
  const networkPassphrase = getNetworkPassphrase();
  const { Transaction } = await import("@stellar/stellar-sdk");
  const tx = new Transaction(signedEnvelopeXdr, networkPassphrase);
  const result = await server.sendTransaction(tx);
  if (result.status === "ERROR") {
    throw new Error(`Soroban submit failed: ${String(result.errorResult)}`);
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
