/**
 * Soroban disbursement: invoke contract payout(caller, recipient, amount).
 * The transaction is signed by the caller (super-admin); the contract checks
 * the caller is an authorized signer and transfers token to the recipient.
 * Server-only. Requires SOROBAN_RPC_URL in env.
 */
import {
  Address,
  Contract,
  Keypair,
  TransactionBuilder,
  rpc,
  xdr,
} from "@stellar/stellar-sdk";
import { amountToI128, getNetworkPassphrase, getSorobanRpcUrl } from "@/lib/stellar/soroban-common";

export type SorobanPayoutOptions = {
  /** Contract ID (C address) of the disbursement wallet. */
  contractId: string;
  /** Secret key of the authorized signer (super-admin). */
  signerSecretKey: string;
  /** Stellar address of the recipient (G or C). */
  recipientAddress: string;
  /** Amount as string (e.g. "10.5" USDC). */
  amount: string;
};

/**
 * Build, sign, and submit a Soroban payout transaction.
 * Calls contract.payout(caller, recipient, amount). The signer must be an
 * authorized signer on the contract.
 * @returns Transaction hash on success.
 */
export async function invokeSorobanPayout(
  options: SorobanPayoutOptions
): Promise<string> {
  const { contractId, signerSecretKey, recipientAddress, amount } = options;
  const keypair = Keypair.fromSecret(signerSecretKey);
  const callerPublicKey = keypair.publicKey();
  const networkPassphrase = getNetworkPassphrase();
  const rpcUrl = getSorobanRpcUrl();

  const server = new rpc.Server(rpcUrl, {
    allowHttp: rpcUrl.startsWith("http://"),
  });

  const account = await server.getAccount(callerPublicKey);
  const contract = new Contract(contractId);
  const amountI128 = amountToI128(amount);

  const callerScVal = Address.fromString(callerPublicKey).toScVal();
  const recipientScVal = Address.fromString(recipientAddress).toScVal();
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
    fee: "100",
    networkPassphrase,
  })
    .addOperation(op)
    .setTimeout(30)
    .build();

  const preparedTx = await server.prepareTransaction(rawTx);
  preparedTx.sign(keypair);

  const result = await server.sendTransaction(preparedTx);
  if (result.status === "ERROR") {
    const errMsg =
      result.errorResult != null
        ? `Soroban tx error: ${String(result.errorResult)}`
        : "Unknown error";
    throw new Error(errMsg);
  }
  if (!result.hash) {
    throw new Error("No transaction hash in Soroban response");
  }
  return result.hash;
}
