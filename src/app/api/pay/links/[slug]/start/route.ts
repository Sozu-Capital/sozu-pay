import { NextRequest, NextResponse } from "next/server";
import { startStandingSale } from "@/lib/checkout/start-standing-sale";
import { getQRPointBySlug } from "@/lib/db/merchant-qr-points";
import { routePayQrPoint } from "@/lib/dashboard/merchant-qr";

type Params = { params: Promise<{ slug: string }> };

/**
 * POST /api/pay/links/[slug]/start
 * Opens a fresh wallet checkout for a standing payment link.
 * Paying once does not consume the link.
 */
export async function POST(request: NextRequest, { params }: Params) {
  const { slug } = await params;
  const hostHeader = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
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

  const minted = await startStandingSale({
    orgId: route.orgId,
    slug: route.slug,
    name: route.name,
    amountUsd: route.amountUsd,
    collectibleReceipt: route.collectibleReceipt,
    editionSize: route.editionSize,
    hostHeader,
  });
  if (!minted.ok) {
    return NextResponse.json({ error: minted.error }, { status: minted.status });
  }

  return NextResponse.json({
    id: minted.id,
    amountUsd: route.amountUsd,
    itemName: route.name,
    productKind: route.productKind,
    collectibleReceipt: route.collectibleReceipt,
    editionNumber: minted.editionNumber,
    editionSize: minted.editionSize,
    checkoutUrl: minted.checkoutUrl,
    walletCheckoutUrl: minted.checkoutUrl,
  });
}
