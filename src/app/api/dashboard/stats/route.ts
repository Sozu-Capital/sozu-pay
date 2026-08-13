import { NextResponse } from "next/server";
import { getDashboardWalletContext } from "@/lib/wallet-resolve-cached";
import { getUsdcBalance } from "@/lib/stellar/balance";
import { getSorobanUsdcBalance } from "@/lib/stellar/soroban-balance";
import { getTransactions } from "@/lib/stellar/transactions";
import { getSession } from "@/lib/auth/session";

/**
 * Aggregated business finance stats for the dashboard.
 * Uses the organization disbursement wallet balance when the user has an org with one; otherwise user wallet.
 * When authenticated but no wallet yet, returns zeros so the dashboard still loads.
 */
export async function GET() {
  const { publicKey, org } = await getDashboardWalletContext();
  if (!publicKey) {
    const session = await getSession();
    if (session) {
      return NextResponse.json({
        balanceUsd: "0.00",
        transactionCount: 0,
        apyPercent: 0,
        creditAvailableUsd: "0.00",
        currency: "USD",
      });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fetch balance (Soroban or classic) and a minimal tx set in parallel.
  // We only need 1 tx to confirm activity exists; a proper count API can come later.
  const [balance, transactions] = await Promise.all([
    publicKey.startsWith("C")
      ? getSorobanUsdcBalance(publicKey)
      : getUsdcBalance(publicKey),
    getTransactions(publicKey, 10, { orgId: org?.id ?? null }),
  ]);

  const balanceNum = parseFloat(balance) || 0;

  // APY: placeholder until vault protocol is integrated
  const apyPercent = 0;

  // Credit available: placeholder heuristic
  const creditAvailableNum = Math.max(0, balanceNum * 0.5);

  return NextResponse.json({
    balanceUsd: balanceNum.toFixed(2),
    transactionCount: transactions.length,
    apyPercent,
    creditAvailableUsd: creditAvailableNum.toFixed(2),
    currency: "USD",
  });
}
