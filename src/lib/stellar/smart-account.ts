/**
 * Soroban smart account creation: create a smart account (C) bound to a signer (G).
 * Uses a factory contract when SMART_ACCOUNT_FACTORY_ID is set.
 * Server-only. Requires SOROBAN_RPC_URL and STELLAR_FUNDER_SECRET (to pay for deployment).
 *
 * Optional: SMART_ACCOUNT_GET_ADDRESS_VIEW (e.g. "get_address") - if set, we call this
 * view with the signer to get the deterministic C address before deploying.
 */

import {
  Address,
  Contract,
  Keypair,
  TransactionBuilder,
  Networks,
  rpc,
  xdr,
} from "@stellar/stellar-sdk";
import { coerceSimulateRetval } from "@/lib/stellar/soroban-common";

function getNetworkPassphrase(): string {
  return process.env.STELLAR_NETWORK === "public"
    ? Networks.PUBLIC
    : Networks.TESTNET;
}

function getSorobanRpcUrl(): string | null {
  const url = process.env.SOROBAN_RPC_URL?.trim();
  return url || null;
}

function getFactoryId(): string | null {
  const id = process.env.SMART_ACCOUNT_FACTORY_ID?.trim();
  return id || null;
}

/**
 * Returns true if the address is a Soroban smart account (C...).
 */
export function isSmartAccount(address: string): boolean {
  return typeof address === "string" && address.startsWith("C");
}

/**
 * Call factory view to get deterministic smart account address for signer (if configured).
 */
async function getSmartAccountAddressFromView(
  server: rpc.Server,
  factoryId: string,
  signerPublicKey: string,
  funderKeypair: Keypair
): Promise<string | null> {
  const viewMethod = process.env.SMART_ACCOUNT_GET_ADDRESS_VIEW?.trim();
  if (!viewMethod) return null;

  const networkPassphrase = getNetworkPassphrase();
  const account = await server.getAccount(funderKeypair.publicKey());
  const contract = new Contract(factoryId);
  const signerScVal = Address.fromString(signerPublicKey).toScVal();
  const op = contract.call(viewMethod, signerScVal);

  const rawTx = new TransactionBuilder(account, {
    fee: "100",
    networkPassphrase,
  })
    .addOperation(op)
    .setTimeout(30)
    .build();

  const sim = await server.simulateTransaction(rawTx) as {
    error?: string;
    result?: { retval?: unknown };
  };
  if ("error" in sim && sim.error != null) return null;
  const retval = coerceSimulateRetval(sim.result?.retval);
  if (!retval) return null;
  const addr = Address.fromScVal(retval);
  const accountId = addr.toString();
  if (accountId.startsWith("C")) return accountId;
  return null;
}

/**
 * Create a smart account for the given signer (G...) via the factory contract.
 * If SMART_ACCOUNT_GET_ADDRESS_VIEW is set, we use it to get the C address first, then deploy.
 * Otherwise we invoke create_account(signer) and return the address only if the factory
 * returns it in a way we can parse (future: parse getTransaction result).
 * @returns The new smart account address (C...) or null if factory not configured or creation fails.
 */
export async function createSmartAccountForSigner(
  signerPublicKey: string
): Promise<string | null> {
  const factoryId = getFactoryId();
  const rpcUrl = getSorobanRpcUrl();
  if (!factoryId || !rpcUrl) {
    return null;
  }

  const funderSecret = process.env.STELLAR_FUNDER_SECRET?.trim();
  if (!funderSecret) {
    console.warn("[smart-account] STELLAR_FUNDER_SECRET not set; cannot create smart account");
    return null;
  }

  let keypair: Keypair;
  try {
    keypair = Keypair.fromSecret(funderSecret);
  } catch {
    console.warn("[smart-account] Invalid STELLAR_FUNDER_SECRET");
    return null;
  }

  const networkPassphrase = getNetworkPassphrase();
  const server = new rpc.Server(rpcUrl, {
    allowHttp: rpcUrl.startsWith("http://"),
  });

  let account;
  try {
    account = await server.getAccount(keypair.publicKey());
  } catch (e) {
    console.error("[smart-account] Failed to load funder account:", e);
    return null;
  }

  // Optional: get deterministic C address from view before deploying
  const knownAddress = await getSmartAccountAddressFromView(
    server,
    factoryId,
    signerPublicKey,
    keypair
  );

  const contract = new Contract(factoryId);
  const signerScVal = Address.fromString(signerPublicKey).toScVal();
  const methodName = process.env.SMART_ACCOUNT_FACTORY_METHOD?.trim() || "create_account";
  const op = contract.call(methodName, signerScVal);

  const rawTx = new TransactionBuilder(account, {
    fee: "100",
    networkPassphrase,
  })
    .addOperation(op)
    .setTimeout(60)
    .build();

  try {
    const preparedTx = await server.prepareTransaction(rawTx);
    preparedTx.sign(keypair);
    const result = await server.sendTransaction(preparedTx);

    if (result.status === "ERROR") {
      console.error("[smart-account] Factory tx error:", result.errorResult);
      return null;
    }
    if (!result.hash) {
      return null;
    }

    if (knownAddress) {
      return knownAddress;
    }

    return null;
  } catch (e) {
    console.error("[smart-account] createSmartAccountForSigner failed:", e);
    return null;
  }
}
