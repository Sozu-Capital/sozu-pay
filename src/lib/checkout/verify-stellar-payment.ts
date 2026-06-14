import { getHorizon } from "@/lib/stellar/server";
import type { Horizon } from "@stellar/stellar-sdk";

export type PaymentVerificationResult =
  | { success: true }
  | { success: false; error: string };

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
  try {
    const horizon = getHorizon();
    
    // Fetch transaction from Horizon
    let tx: Horizon.ServerApi.TransactionRecord;
    try {
      tx = await horizon.transactions().transaction(transactionHash).call();
    } catch (err) {
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

    // Look for payment operation to expected destination
    const expectedAmount = parseFloat(expectedAmountUsd);
    const tolerance = 0.01; // $0.01 tolerance for decimal rounding

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
        // Soroban payment - check effects for transfer
        const effects = await horizon
          .effects()
          .forOperation(op.id)
          .limit(200)
          .call();

        for (const effect of effects.records) {
          // Look for contract_debited/credited effects
          if (
            (effect.type === "contract_credited" || effect.type === "contract_debited") &&
            "asset_code" in effect
          ) {
            const contractEffect = effect as any;
            
            // Check if this is USDC and to the right destination
            if (
              (contractEffect.asset_code === "USDC" || contractEffect.asset_code === "USD") &&
              contractEffect.contract === expectedDestination
            ) {
              const actualAmount = parseFloat(contractEffect.amount);
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
    console.error("[verify-stellar-payment] Error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Verification failed",
    };
  }
}
