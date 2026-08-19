import { NextRequest, NextResponse } from "next/server";
import { getQRPointBySlug } from "@/lib/db/merchant-qr-points";
import { getOrganizationById } from "@/lib/db/organizations";
import { createPizzaRedeem } from "@/lib/db/pizza-redeems";
import { resolveCheckoutSettleToAddress } from "@/lib/checkout/settle-to";
import { getPizzaTokenId } from "@/lib/stellar/pizza-token";
import {
  buildPizzaRedeemTransfer,
  getWalletOrigin,
  pizzaRedeemWalletSignUrl,
} from "@/lib/pizza/redeem";
import { merchantQrPayUrl } from "@/lib/checkout-url";

function isStellarAddress(raw: string): boolean {
  return /^[GC][A-Z0-9]{55}$/.test(raw.trim().toUpperCase());
}

/**
 * POST /api/pizza/redeems
 * Create a standing pizza SKU redeem intent (1 PIZZA → store treasury).
 * Does not complete checkout_sessions.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const slug = typeof body.slug === "string" ? body.slug.trim().toLowerCase() : "";
  const guestAddress =
    typeof body.guestAddress === "string" ? body.guestAddress.trim().toUpperCase() : "";

  if (!slug) {
    return NextResponse.json({ error: "slug is required" }, { status: 400 });
  }
  if (!isStellarAddress(guestAddress)) {
    return NextResponse.json({ error: "guestAddress must be a Stellar G or C address" }, { status: 400 });
  }

  const qr = await getQRPointBySlug(slug);
  if (!qr || qr.destinationType !== "pizza_sku" || !qr.isOnline) {
    return NextResponse.json({ error: "Pizza SKU not found" }, { status: 404 });
  }

  const org = await getOrganizationById(qr.orgId);
  if (!org) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  const storeSettleTo = resolveCheckoutSettleToAddress(org);
  if (!storeSettleTo) {
    return NextResponse.json({ error: "Store treasury is not configured" }, { status: 422 });
  }

  let pizzaTokenId: string;
  try {
    pizzaTokenId = getPizzaTokenId();
  } catch {
    return NextResponse.json({ error: "PizzaToken is not configured" }, { status: 503 });
  }

  const transfer = buildPizzaRedeemTransfer({
    pizzaTokenId,
    guestAddress,
    storeSettleTo,
  });

  const redeem = await createPizzaRedeem({
    qrPointId: qr.id,
    orgId: qr.orgId,
    guestAddress,
    storeAddress: transfer.to,
    tokenId: transfer.contractId,
  });

  const returnTo = `${merchantQrPayUrl(slug, request)}?intent=${encodeURIComponent(redeem.id)}`;
  const signUrl = pizzaRedeemWalletSignUrl({
    walletOrigin: getWalletOrigin(),
    intentId: redeem.id,
    returnTo,
  });

  return NextResponse.json({
    redeem: {
      id: redeem.id,
      status: redeem.status,
      amount: redeem.amount,
      tokenId: redeem.tokenId,
      from: redeem.guestAddress,
      to: redeem.storeAddress,
      transfer: {
        contractId: transfer.contractId,
        method: transfer.method,
        from: transfer.from,
        to: transfer.to,
        amount: transfer.amount.toString(),
      },
    },
    signUrl,
    completesCheckoutSession: false,
  });
}
