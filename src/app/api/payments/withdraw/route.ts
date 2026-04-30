import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getUserByPrivyId } from "@/lib/db/users";
import {
  createWithdrawalRequest,
  getLedgerBalanceForWallet,
  getLedgerWalletByOrgId,
} from "@/lib/db/shadow-ledger";
import { USDC_MINOR_SCALE, usdcMinorToDisplayString } from "@/lib/shadow-ledger-quote";

/**
 * POST /api/payments/withdraw — queue CLP withdrawal (ops fulfills manually; debits ledger on fulfill).
 * Body: { amountUsdc: string (e.g. "10.5"), note?: string }
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await getUserByPrivyId(session.id);
  if (!user?.org_id) {
    return NextResponse.json({ error: "Organization required" }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const amountStr = typeof body.amountUsdc === "string" ? body.amountUsdc : "";
  const num = Number.parseFloat(amountStr);
  if (!Number.isFinite(num) || num <= 0) {
    return NextResponse.json({ error: "Invalid amountUsdc" }, { status: 400 });
  }

  const note = typeof body.note === "string" ? body.note.slice(0, 1000) : null;
  const amountMinor = BigInt(Math.floor(num * USDC_MINOR_SCALE));
  if (amountMinor <= BigInt(0)) {
    return NextResponse.json({ error: "Amount too small" }, { status: 400 });
  }

  try {
    const wallet = await getLedgerWalletByOrgId(user.org_id);
    if (!wallet) {
      return NextResponse.json({ error: "No ledger wallet for org" }, { status: 400 });
    }

    const bal = await getLedgerBalanceForWallet(wallet.id);
    const available = BigInt(bal?.available_minor ?? 0);
    if (available < amountMinor) {
      return NextResponse.json(
        {
          error: "Insufficient ledger balance",
          availableUsdc: usdcMinorToDisplayString(available),
        },
        { status: 400 }
      );
    }

    const row = await createWithdrawalRequest({
      orgId: user.org_id,
      walletId: wallet.id,
      amountUsdcMinor: amountMinor,
      note,
      requestedByUserId: user.id,
    });

    return NextResponse.json({
      request: {
        id: row.id,
        amountUsdc: usdcMinorToDisplayString(amountMinor),
        amountUsdcMinor: amountMinor.toString(),
        status: row.status,
        note: row.note,
        createdAt: row.created_at,
      },
      message:
        "Request queued. Operations will send CLP off-platform and mark the request fulfilled to debit your ledger USDC.",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("withdrawal_requests") || msg.includes("does not exist")) {
      return NextResponse.json(
        { error: "Shadow ledger not initialized", hint: "Run docs/supabase-shadow-ledger.sql" },
        { status: 503 }
      );
    }
    console.error("[payments/withdraw]", err);
    return NextResponse.json({ error: "Failed to create withdrawal request" }, { status: 500 });
  }
}
