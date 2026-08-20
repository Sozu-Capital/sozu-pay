/**
 * Send PizzaToken (SEP-41) from org treasury to an app.sozu.capital wallet.
 * Always a contract transfer — never a Horizon USDC payment, never Circle SAC.
 */
import {
  Address,
  Contract,
  Keypair,
  TransactionBuilder,
  rpc,
  xdr,
} from "@stellar/stellar-sdk";
import { isValidStellarReceiveAddress, normalizeStellarAddressInput } from "@/lib/payment/stellar-address";
import { parsePizzaSendAmount } from "@/lib/payouts/asset";
import { getNetworkPassphrase, getSorobanRpcUrl } from "@/lib/stellar/soroban-common";
import { getPizzaTokenId, pizzaAmountToI128 } from "@/lib/stellar/pizza-token";

const ORG_SECRET_ENV_KEYS = [
  "ORG_DISBURSEMENT_SECRET",
  "STELLAR_DISBURSEMENT_SECRET",
  "STELLAR_FUNDER_SECRET",
] as const;

function getOrgDisbursementKeypair(): Keypair {
  for (const key of ORG_SECRET_ENV_KEYS) {
    const secret = process.env[key]?.trim();
    if (secret) {
      try {
        return Keypair.fromSecret(secret);
      } catch {
        throw new Error(`${key} is not a valid Stellar secret key.`);
      }
    }
  }
  throw new Error(
    "Org disbursement wallet not configured. Set ORG_DISBURSEMENT_SECRET (or STELLAR_DISBURSEMENT_SECRET / STELLAR_FUNDER_SECRET).",
  );
}

function i128ScValFromBigInt(amount: bigint): xdr.ScVal {
  const mask64 = BigInt("0xffffffffffffffff");
  const lo = amount & mask64;
  const hi = amount >> BigInt(64);
  return xdr.ScVal.scvI128(
    new xdr.Int128Parts({
      lo: lo as unknown as xdr.Uint64,
      hi: hi as unknown as xdr.Uint64,
    }),
  );
}

export async function sendPizzaToken(
  destinationAddress: string,
  amount: string,
  signerSecretKey?: string,
): Promise<string> {
  const destination = normalizeStellarAddressInput(destinationAddress);
  if (!isValidStellarReceiveAddress(destination)) {
    throw new Error("PIZZA destination must be a Stellar G… or C… wallet.");
  }
  const pizzas = parsePizzaSendAmount(amount);
  const signer = signerSecretKey ? Keypair.fromSecret(signerSecretKey) : getOrgDisbursementKeypair();
  const tokenId = getPizzaTokenId();

  const rpcUrl = getSorobanRpcUrl();
  const server = new rpc.Server(rpcUrl, { allowHttp: rpcUrl.startsWith("http://") });
  const networkPassphrase = getNetworkPassphrase();
  const token = new Contract(tokenId);

  const account = await server.getAccount(signer.publicKey());
  const rawTx = new TransactionBuilder(account, {
    fee: "100000",
    networkPassphrase,
  })
    .addOperation(
      token.call(
        "transfer",
        Address.fromString(signer.publicKey()).toScVal(),
        Address.fromString(destination).toScVal(),
        i128ScValFromBigInt(pizzaAmountToI128(pizzas)),
      ),
    )
    .setTimeout(60)
    .build();

  let prepared;
  try {
    prepared = await server.prepareTransaction(rawTx);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[sendPizza] SEP-41 transfer prepare failed:", {
      destination,
      amount: pizzas,
      from: signer.publicKey(),
      tokenId,
      error: msg,
    });
    throw new Error(
      `Could not send ${pizzas} PIZZA to ${destination.slice(0, 8)}… — ${msg}`,
    );
  }

  prepared.sign(signer);
  const result = await server.sendTransaction(prepared);
  if (result.status === "ERROR") {
    const detail = String(result.errorResult ?? "Soroban submit failed");
    throw new Error(detail);
  }
  if (!result.hash) throw new Error("No transaction hash from Soroban RPC");
  return result.hash;
}
