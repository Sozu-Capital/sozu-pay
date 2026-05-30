import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getUserBySessionId } from "@/lib/db/users";
import {
  formatOrderForApi,
  getLedgerBalanceForWallet,
  getLedgerWalletByOrgId,
  listLedgerTransactionsForWallet,
  listPaymentOrdersByOrg,
  listWithdrawalRequestsForOrg,
} from "@/lib/db/shadow-ledger";
import { usdcMinorToDisplayString } from "@/lib/shadow-ledger-quote";

/**
 * GET /api/payments/ledger-summary — internal ledger USDC + recent movements (shadow rail POC).
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await getUserBySessionId(session.id);
  if (!user?.org_id) {
    return NextResponse.json(
      { ledgerAvailableUsdc: "0", transactions: [], pendingOrders: [], initialized: false },
      { status: 200 }
    );
  }

  try {
    const wallet = await getLedgerWalletByOrgId(user.org_id);
    if (!wallet) {
      return NextResponse.json({
        initialized: false,
        ledgerAvailableUsdc: "0",
        ledgerAvailableMinor: "0",
        transactions: [],
        pendingOrders: [],
      });
    }

    const balance = await getLedgerBalanceForWallet(wallet.id);
    const minor = BigInt(balance?.available_minor ?? 0);
    const orders = await listPaymentOrdersByOrg(user.org_id, 40);
    const recentOrders = orders.map(formatOrderForApi);
    const pendingOrders = recentOrders.filter(
      (o) => o.status === "pending_payment" || o.status === "awaiting_confirmation"
    );

    const withdrawalRows = await listWithdrawalRequestsForOrg(user.org_id, 20);
    const withdrawalRequests = withdrawalRows.map((w) => ({
      id: w.id,
      amountUsdc: usdcMinorToDisplayString(BigInt(w.amount_usdc_minor)),
      status: w.status,
      note: w.note,
      createdAt: w.created_at,
    }));

    const txRows = await listLedgerTransactionsForWallet(wallet.id, 25);
    const transactions = txRows.map((t) => ({
      id: t.id,
      type: t.type,
      amountMinor: String(t.amount_minor),
      amountUsdc: usdcMinorToDisplayString(BigInt(Math.abs(t.amount_minor))),
      signed: t.amount_minor >= 0 ? "credit" : "debit",
      balanceAfterMinor:
        t.balance_after_minor != null ? String(t.balance_after_minor) : null,
      memo: t.memo,
      createdAt: t.created_at,
    }));

    return NextResponse.json({
      initialized: true,
      ledgerAvailableUsdc: usdcMinorToDisplayString(minor),
      ledgerAvailableMinor: minor.toString(),
      walletId: wallet.id,
      pendingOrders,
      recentOrders,
      withdrawalRequests,
      transactions,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("ledger_wallets") || msg.includes("does not exist")) {
      return NextResponse.json(
        {
          error: "Shadow ledger not initialized",
          hint: "Run docs/supabase-shadow-ledger.sql in Supabase.",
        },
        { status: 503 }
      );
    }
    console.error("[payments/ledger-summary]", err);
    return NextResponse.json({ error: "Failed to load ledger" }, { status: 500 });
  }
}
