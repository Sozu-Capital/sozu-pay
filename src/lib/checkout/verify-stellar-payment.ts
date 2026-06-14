import { getHorizon } from "@/lib/stellar/server";
import type { Horizon } from "@stellar/stellar-sdk";
import { Address, rpc, xdr } from "@stellar/stellar-sdk";
import { coerceSimulateRetval, getSorobanRpcUrl } from "@/lib/stellar/soroban-common";
import { getSorobanUsdcTokenId } from "@/lib/stellar/org-treasury";

export type PaymentVerificationResult =
  | { success: true }
  | { success: false; error: string };

interface SorobanEventsRequest {
  startLedger: number;
  filters: Array<{ type: "contract"; contractIds: string[] }>;
  pagination: { limit: number };
}

interface SorobanEvent {
  ledger?: number;
  txHash?: string;
  contractId?: string;
  topic?: unknown[];
  value?: unknown;
}

interface SorobanEventsResponse {
  events?: SorobanEvent[];
}

type RpcServerWithEvents = rpc.Server & {
  getEvents: (req: SorobanEventsRequest) => Promise<SorobanEventsResponse>;
};

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
 * Verify a Stellar transaction for checkout completion.
 * Checks that the tx succeeded on-chain, sent USDC to the correct destination,
 * and the amount matches (within tolerance for Soroban 7-decimal USDC).
 */
export async function verifyStellarPayment(
  transactionHash: string,
  expectedDestination: string,
  expectedAmountUsd: string
): Promise<PaymentVerificationResult> {
  const tolerance = 0.01; // $0.01 tolerance for decimal rounding
  const expectedAmount = parseFloat(expectedAmountUsd);

  // 1. Try verifying using Soroban RPC events first (fast, bypasses Horizon indexing delay)
  try {
    const rpcUrl = getSorobanRpcUrl();
    const server = new rpc.Server(rpcUrl, { allowHttp: rpcUrl.startsWith("http://") });
    const rpcTx = await server.getTransaction(transactionHash);
    
    if (rpcTx.status === "SUCCESS" && rpcTx.ledger) {
      const tokenId = getSorobanUsdcTokenId();
      const res = await (server as unknown as RpcServerWithEvents).getEvents({
        startLedger: rpcTx.ledger,
        filters: [{ type: "contract", contractIds: [tokenId] }],
        pagination: { limit: 100 },
      });
      
      const events = res?.events ?? [];
      for (const ev of events) {
        if (ev.txHash?.toLowerCase() !== transactionHash.toLowerCase()) continue;
        if (!ev.topic || !Array.isArray(ev.topic) || ev.topic.length < 3) continue;
        
        let t0: xdr.ScVal | null = null;
        let from: string | null = null;
        let to: string | null = null;
        try {
          t0 = coerceSimulateRetval(ev.topic[0]);
          const t1 = coerceSimulateRetval(ev.topic[1]);
          const t2 = coerceSimulateRetval(ev.topic[2]);
          if (t1?.switch().name === "scvAddress") from = Address.fromScVal(t1).toString();
          if (t2?.switch().name === "scvAddress") to = Address.fromScVal(t2).toString();
        } catch {
          continue;
        }
        
        if (!t0 || t0.switch().name !== "scvSymbol" || t0.sym().toString() !== "transfer") continue;
        if (!from || !to) continue;
        
        if (to.toUpperCase() === expectedDestination.toUpperCase()) {
          const val = coerceSimulateRetval(ev.value);
          const actualAmount = val ? parseFloat(i128ToDecimalString(scValI128ToBigInt(val), 7)) : 0;
          if (Math.abs(actualAmount - expectedAmount) <= tolerance) {
            console.log(`[verify-stellar-payment] Verified Soroban transfer event via RPC of ${actualAmount} USDC to ${to} in tx ${transactionHash}`);
            return { success: true };
          }
        }
      }
    }
  } catch (rpcErr) {
    console.warn("[verify-stellar-payment] Soroban RPC verification skipped or failed:", rpcErr);
  }

  // 2. Horizon fallback (classic payments or if RPC failed/was missing)
  try {
    const horizon = getHorizon();
    
    // Fetch transaction from Horizon
    let tx: Horizon.ServerApi.TransactionRecord;
    try {
      tx = await horizon.transactions().transaction(transactionHash).call();
    } catch (_err) {
      return { success: false, error: "Transaction not found on network" };
    }

    // Check transaction succeeded
    if (!tx.successful) {
      return { success: false, error: "Transaction failed on ledger" };
    }

    // Fetch operations to find payment
    const operations = await horizon
      .operations()
      .forTransaction(transactionHash)
      .limit(200)
      .call();

    for (const op of operations.records) {
      // Check both classic payment and Soroban invoke_host_function operations
      if (op.type === "payment") {
        const payment = op as Horizon.ServerApi.PaymentOperationRecord;
        
        // Check destination matches
        if (payment.to !== expectedDestination) {
          continue;
        }

        // Check asset is USDC (could be USDC:ISSUER or native USDC on Soroban)
        const assetCode = payment.asset_type === "native" ? "XLM" : payment.asset_code;
        if (assetCode !== "USDC" && assetCode !== "USD") {
          continue;
        }

        // Check amount matches within tolerance
        const actualAmount = parseFloat(payment.amount);
        if (Math.abs(actualAmount - expectedAmount) <= tolerance) {
          return { success: true };
        }
      } else if (op.type === "invoke_host_function") {
        // First check asset_balance_changes (cleaner, no separate API call needed)
        const assetChanges = (op as { asset_balance_changes?: Array<{
          asset_code?: string;
          type?: string;
          to?: string;
          amount?: string;
        }> }).asset_balance_changes;
        
        if (Array.isArray(assetChanges)) {
          for (const change of assetChanges) {
            if (
              (change.asset_code === "USDC" || change.asset_code === "USD") &&
              change.type === "transfer" &&
              change.to?.toUpperCase() === expectedDestination.toUpperCase()
            ) {
              const actualAmount = parseFloat(change.amount ?? "0");
              if (Math.abs(actualAmount - expectedAmount) <= tolerance) {
                return { success: true };
              }
            }
          }
        }

        // Fallback: Soroban payment - check effects for transfer
        const effects = await horizon
          .effects()
          .forOperation(op.id)
          .limit(200)
          .call();

        for (const effect of effects.records) {
          const eff = effect as { asset_code?: string; contract?: string; account?: string; amount?: string };
          if (
            effect.type === "contract_credited" &&
            "asset_code" in effect &&
            "contract" in effect &&
            "amount" in effect
          ) {
            const assetCode = eff.asset_code;
            const contract = eff.contract;
            const amount = eff.amount;
            
            if (
              (assetCode === "USDC" || assetCode === "USD") &&
              contract?.toUpperCase() === expectedDestination.toUpperCase()
            ) {
              const actualAmount = parseFloat(amount ?? "0");
              if (Math.abs(actualAmount - expectedAmount) <= tolerance) {
                return { success: true };
              }
            }
          } else if (
            effect.type === "account_credited" &&
            "asset_code" in effect &&
            "account" in effect &&
            "amount" in effect
          ) {
            const assetCode = eff.asset_code;
            const account = eff.account;
            const amount = eff.amount;
            
            if (
              (assetCode === "USDC" || assetCode === "USD") &&
              account?.toUpperCase() === expectedDestination.toUpperCase()
            ) {
              const actualAmount = parseFloat(amount ?? "0");
              if (Math.abs(actualAmount - expectedAmount) <= tolerance) {
                return { success: true };
              }
            }
          }
        }
      }
    }

    return {
      success: false,
      error: "No matching USDC payment found to destination",
    };
  } catch (err) {
    console.error("[verify-stellar-payment] Horizon fallback error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Verification failed",
    };
  }
}
