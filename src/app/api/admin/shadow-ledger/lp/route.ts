import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getUserByPrivyId } from "@/lib/db/users";
import { getUsdcBalance } from "@/lib/stellar/balance";

function isAdmin(level: string) {
  return level === "admin" || level === "super_admin";
}

const STELLAR_EXPERT_BASE =
  process.env.NEXT_PUBLIC_STELLAR_NETWORK === "public"
    ? "https://stellar.expert/explorer/public"
    : "https://stellar.expert/explorer/testnet";

/**
 * GET /api/admin/shadow-ledger/lp — optional on-chain USDC balance for the prefunded LP (Phase G).
 * Set SHADOW_LP_STELLAR_PUBLIC_KEY (G...) to enable. Compares to SHADOW_LP_ALERT_USDC_MIN for a low-liquidity flag.
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await getUserByPrivyId(session.id);
  if (!user || !isAdmin(user.admin_level)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const publicKey = process.env.SHADOW_LP_STELLAR_PUBLIC_KEY?.trim();
  if (!publicKey) {
    return NextResponse.json({
      configured: false,
      message: "Set SHADOW_LP_STELLAR_PUBLIC_KEY to monitor LP USDC on Horizon.",
    });
  }

  const usdc = await getUsdcBalance(publicKey);
  const num = parseFloat(usdc) || 0;
  const minRaw = process.env.SHADOW_LP_ALERT_USDC_MIN?.trim();
  const min = minRaw != null && minRaw !== "" ? parseFloat(minRaw) : NaN;
  const lowLiquidity = Number.isFinite(min) && num < min;

  return NextResponse.json({
    configured: true,
    publicKey,
    usdcBalance: usdc,
    stellarExpertUrl: `${STELLAR_EXPERT_BASE}/account/${publicKey}`,
    alertThresholdUsdc: Number.isFinite(min) ? String(min) : null,
    lowLiquidity: Number.isFinite(min) ? lowLiquidity : null,
  });
}
