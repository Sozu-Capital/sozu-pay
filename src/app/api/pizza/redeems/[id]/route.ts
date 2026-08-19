import { NextRequest, NextResponse } from "next/server";
import { getPizzaRedeem, markPizzaRedeemSubmitted } from "@/lib/db/pizza-redeems";
import { getWalletOrigin } from "@/lib/pizza/redeem";

type Params = { params: Promise<{ id: string }> };

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": getWalletOrigin(),
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: corsHeaders() });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

/**
 * GET /api/pizza/redeems/[id]
 * Public poll for claimed UI. Intent id is the capability token.
 */
export async function GET(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  const redeem = await getPizzaRedeem(id);
  if (!redeem) {
    return json({ error: "Not found" }, 404);
  }
  return json({
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
    return json({ error: "Not found" }, 404);
  }

  const body = await request.json().catch(() => ({}));
  const txHash = typeof body.txHash === "string" ? body.txHash.trim() : "";
  if (!txHash) {
    return json({ error: "txHash is required" }, 400);
  }

  const redeem = await markPizzaRedeemSubmitted(id, txHash);
  if (!redeem) {
    return json({ error: "Update failed" }, 500);
  }

  return json({
    redeem: {
      id: redeem.id,
      status: redeem.status,
      amount: redeem.amount,
      txHash: redeem.txHash,
    },
    completesCheckoutSession: false,
  });
}
