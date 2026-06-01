/**
 * Read Soroban token balances via simulation (server-only).
 */
import "server-only";

import {
  Address,
  Contract,
  Keypair,
  TransactionBuilder,
  rpc,
  xdr,
} from "@stellar/stellar-sdk";
import {
  coerceSimulateRetval,
  getNetworkPassphrase,
  getSorobanRpcUrl,
} from "@/lib/stellar/soroban-common";
import { getSorobanUsdcTokenId } from "@/lib/stellar/org-treasury";

const USDC_EXP = 7;

// Short-TTL in-memory cache so rapid dashboard loads don't hammer the Soroban RPC.
// Keep this low so external deposits show up quickly.
const SOROBAN_BALANCE_CACHE_TTL_MS = 5_000;
type BalanceCacheEntry = { balance: string; fetchedAt: number };
const sorobanBalanceCache = new Map<string, BalanceCacheEntry>();

function getSimFunderKeypair(): Keypair {
  const secret = process.env.STELLAR_FUNDER_SECRET?.trim();
  if (!secret) throw new Error("STELLAR_FUNDER_SECRET is not configured.");
  return Keypair.fromSecret(secret);
}

function scValI128ToBigInt(val: xdr.ScVal): bigint {
  if (val.switch().name !== "scvI128") return BigInt(0);
  const parts = val.i128();
  const lo = BigInt(parts.lo().toString());
  const hi = BigInt(parts.hi().toString());
  return (hi << BigInt(64)) + lo;
}

function i128ToDecimalString(amount: bigint, decimals: number): string {
  const negative = amount < BigInt(0);
  const abs = negative ? -amount : amount;
  const divisor = BigInt(10 ** decimals);
  const whole = abs / divisor;
  const frac = abs % divisor;
  const fracStr = frac.toString().padStart(decimals, "0").replace(/0+$/, "");
  const num = fracStr ? `${whole}.${fracStr}` : whole.toString();
  return negative ? `-${num}` : num;
}

/**
 * USDC balance held by a Soroban contract (disbursement pool C address).
 * Results are cached for 25 seconds to avoid paying 2 RPC round-trips on
 * every dashboard render.
 */
export async function getSorobanUsdcBalance(holderContractId: string): Promise<string> {
  const now = Date.now();
  const cached = sorobanBalanceCache.get(holderContractId);
  if (cached && now - cached.fetchedAt < SOROBAN_BALANCE_CACHE_TTL_MS) {
    return cached.balance;
  }

  const tokenId = getSorobanUsdcTokenId();
  const funder = getSimFunderKeypair();
  const rpcUrl = getSorobanRpcUrl();
  const server = new rpc.Server(rpcUrl, { allowHttp: rpcUrl.startsWith("http://") });
  const networkPassphrase = getNetworkPassphrase();

  const account = await server.getAccount(funder.publicKey());
  const token = new Contract(tokenId);
  const holderScVal = Address.fromString(holderContractId).toScVal();
  const op = token.call("balance", holderScVal);

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
  const retval = coerceSimulateRetval(sim.result?.retval);
  if (sim.error || !retval) {
    sorobanBalanceCache.set(holderContractId, { balance: "0", fetchedAt: now });
    return "0";
  }
  const amount = scValI128ToBigInt(retval);
  const balance = i128ToDecimalString(amount, USDC_EXP);
  sorobanBalanceCache.set(holderContractId, { balance, fetchedAt: now });
  return balance;
}
