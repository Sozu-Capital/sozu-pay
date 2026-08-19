import { NextRequest, NextResponse } from "next/server";
import { getPizzaRedeem, markPizzaRedeemSubmitted } from "@/lib/db/pizza-redeems";

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/pizza/redeems/[id]
 * Public poll for claimed UI. Intent id is the capability token.
 */
export async function GET(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  const redeem = await getPizzaRedeem(id);
  if (!redeem) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({
    redeem: {
      id: redeem.id,
      status: redeem.status,
      amount: redeem.amount,
      txHash: redeem.txHash,
    },
    completesCheckoutSession: false,
  });
}

/**
 * POST /api/pizza/redeems/[id]
 * Wallet origin reports a submitted PizzaToken transfer. Never completes checkout_sessions.
 */
export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const existing = await getPizzaRedeem(id);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const txHash = typeof body.txHash === "string" ? body.txHash.trim() : "";
  if (!txHash) {
    return NextResponse.json({ error: "txHash is required" }, { status: 400 });
  }

  const redeem = await markPizzaRedeemSubmitted(id, txHash);
  if (!redeem) {
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }

  return NextResponse.json({
    redeem: {
      id: redeem.id,
      status: redeem.status,
      amount: redeem.amount,
      txHash: redeem.txHash,
    },
    completesCheckoutSession: false,
  });
}
