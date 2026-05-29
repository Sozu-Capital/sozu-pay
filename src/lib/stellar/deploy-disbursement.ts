/**
 * Deploy disbursement_wallet Soroban contract instances (server-only).
 * Uses @stellar/stellar-sdk (no Stellar CLI) so this works on Vercel.
 * Requires DISBURSEMENT_WALLET_WASM_HASH and STELLAR_FUNDER_SECRET.
 */
import "server-only";

import { randomBytes } from "node:crypto";
import {
  Address,
  Keypair,
  Operation,
  StrKey,
  TransactionBuilder,
  hash,
  rpc,
  xdr,
} from "@stellar/stellar-sdk";
import { getNetworkPassphrase, getSorobanRpcUrl } from "@/lib/stellar/soroban-common";

export function getDisbursementWasmHash(): string {
  const hashValue = process.env.DISBURSEMENT_WALLET_WASM_HASH?.trim();
  if (!hashValue) {
    throw new Error(
      "DISBURSEMENT_WALLET_WASM_HASH is required. Run scripts/deploy-testnet-contracts.sh to upload WASM."
    );
  }
  return hashValue;
}

function getFunderSecret(): string {
  const secret = process.env.STELLAR_FUNDER_SECRET?.trim();
  if (!secret) throw new Error("STELLAR_FUNDER_SECRET is not configured.");
  return secret;
}

function deriveContractId(params: {
  networkPassphrase: string;
  deployerPublicKey: string;
  salt: Buffer;
}): string {
  const networkId = hash(Buffer.from(params.networkPassphrase));
  const preimage = xdr.HashIdPreimage.envelopeTypeContractId(
    new xdr.HashIdPreimageContractId({
      networkId,
      contractIdPreimage: xdr.ContractIdPreimage.contractIdPreimageFromAddress(
        new xdr.ContractIdPreimageFromAddress({
          address: new Address(params.deployerPublicKey).toScAddress(),
          salt: params.salt,
        })
      ),
    })
  );
  return StrKey.encodeContract(hash(preimage.toXDR()));
}

/**
 * Deploy a new disbursement_wallet contract instance from the uploaded WASM hash.
 */
export async function deployDisbursementContract(): Promise<string> {
  const wasmHashHex = getDisbursementWasmHash();
  const wasmHash = Buffer.from(wasmHashHex, "hex");
  if (wasmHash.length !== 32) {
    throw new Error("DISBURSEMENT_WALLET_WASM_HASH must be 64 hex characters (32 bytes).");
  }

  const keypair = Keypair.fromSecret(getFunderSecret());
  const rpcUrl = getSorobanRpcUrl();
  const networkPassphrase = getNetworkPassphrase();
  const server = new rpc.Server(rpcUrl, { allowHttp: rpcUrl.startsWith("http://") });

  const salt = randomBytes(32);
  const contractId = deriveContractId({
    networkPassphrase,
    deployerPublicKey: keypair.publicKey(),
    salt,
  });

  const account = await server.getAccount(keypair.publicKey());
  const deployOp = Operation.createCustomContract({
    address: new Address(keypair.publicKey()),
    wasmHash,
    salt,
    constructorArgs: [],
  });

  const rawTx = new TransactionBuilder(account, {
    fee: "100000",
    networkPassphrase,
  })
    .addOperation(deployOp)
    .setTimeout(60)
    .build();

  const prepared = await server.prepareTransaction(rawTx);
  prepared.sign(keypair);

  const sent = await server.sendTransaction(prepared);
  if (sent.status === "ERROR") {
    throw new Error(`Deploy failed: ${String(sent.errorResult)}`);
  }
  if (!sent.hash) throw new Error("Deploy: no transaction hash returned.");

  const polled = await server.pollTransaction(sent.hash, { attempts: 60 });
  if (polled.status !== rpc.Api.GetTransactionStatus.SUCCESS) {
    throw new Error(`Deploy tx ${sent.hash} did not succeed (${polled.status}).`);
  }

  return contractId;
}
