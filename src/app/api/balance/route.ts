import { NextResponse } from "next/server";
import { getDashboardBalancePublicKey } from "@/lib/wallet-resolve";
import { getUsdcBalance } from "@/lib/stellar/balance";
import { getUsdToLocalRate, convertUsdToLocal } from "@/lib/fx";

/**
 * USDC balance for the dashboard. Uses org disbursement wallet when user has an org with one; else user wallet.
 * When authenticated but no wallet yet (e.g. before org setup), returns zeros so the dashboard still loads.
 *
 * Response shape includes both legacy USD fields and new localFiat* fields for the store balance screen.
 */
export async function GET() {
  const publicKey = await getDashboardBalancePublicKey();
  if (!publicKey) {
    const { getSession } = await import("@/lib/auth/session");
    const session = await getSession();
    if (session) {
      return NextResponse.json({
        usdc: "0",
        available: "0",
        inVault: "0",
        fiatAmount: "0.00",
        fiatCurrency: "USD",
        localFiatAmount: "0.00",
        localFiatCurrency: "USD",
        rateSource: "1 USDC = 1 USD",
      });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [usdcBalance, inVault, fx] = await Promise.all([
    getUsdcBalance(publicKey),
    Promise.resolve("0"),
    getUsdToLocalRate(),
  ]);

  const num = parseFloat(usdcBalance) || 0;
  const localFiatAmount = convertUsdToLocal(num, fx.rate);

  return NextResponse.json({
    usdc: usdcBalance,
    available: usdcBalance,
    inVault,
    // Legacy USD fields (used by NGO/DashboardBalance)
    fiatAmount: num.toFixed(2),
    fiatCurrency: "USD",
    rateSource: fx.source,
    // Local fiat fields (used by StoreHomeDashboard)
    localFiatAmount,
    localFiatCurrency: fx.currency,
  });
}
