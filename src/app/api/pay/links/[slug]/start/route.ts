import { NextResponse } from "next/server";
import { STANDING_LINK_FX_SOURCE } from "@/lib/dashboard/payment-link";
import { mintReusableCheckout } from "@/lib/checkout/mint-reusable-checkout";
import { getQRPointBySlug } from "@/lib/db/merchant-qr-points";
import { routePayQrPoint } from "@/lib/dashboard/merchant-qr";

type Params = { params: Promise<{ slug: string }> };

/**
 * POST /api/pay/links/[slug]/start
 * Opens a fresh wallet checkout for a standing payment link.
 * Paying once does not consume the link.
 */
export async function POST(_request: Request, { params }: Params) {
  const { slug } = await params;
  const qr = await getQRPointBySlug(slug);
  if (!qr) {
    return NextResponse.json({ error: "Payment link not found" }, { status: 404 });
  }

  const route = routePayQrPoint(qr);
  if (route.kind === "offline") {
    return NextResponse.json({ error: "This payment link is offline" }, { status: 409 });
  }
  if (route.kind !== "standing_price") {
    return NextResponse.json({ error: "This link has no price" }, { status: 409 });
  }

  const minted = await mintReusableCheckout({
    orgId: route.orgId,
    amountUsd: route.amountUsd,
    reference: route.name,
    fxSource: STANDING_LINK_FX_SOURCE,
  });
  if (!minted.ok) {
    return NextResponse.json({ error: minted.error }, { status: minted.status });
  }

  return NextResponse.json({
    id: minted.id,
    amountUsd: route.amountUsd,
    itemName: route.name,
    walletCheckoutUrl: minted.walletCheckoutUrl,
  });
}
