import { NextRequest, NextResponse } from "next/server";
import { startStandingSale } from "@/lib/checkout/start-standing-sale";
import { isOrganizationId, parseStorePathSegment } from "@/lib/dashboard/payment-link";
import { routePayQrPoint } from "@/lib/dashboard/merchant-qr";
import { getQRPointByOrgAndSlug } from "@/lib/db/merchant-qr-points";
import { getOrganizationById, getOrganizationBySlug } from "@/lib/db/organizations";

type Params = { params: Promise<{ slug: string; item: string }> };

/**
 * POST /api/pay/links/[slug]/[item]/start
 * Opens a fresh wallet checkout for one store's standing payment link.
 * The first segment is the store. It shares the name `slug` with the older
 * one-segment route so Next can build both paths.
 */
export async function POST(request: NextRequest, { params }: Params) {
  const { slug: rawStore, item: rawItem } = await params;
  const store = parseStorePathSegment(rawStore);
  const item = rawItem.trim().toLowerCase();
  if (!store || !/^[a-z0-9_-]+$/.test(item)) {
    return NextResponse.json({ error: "Payment link not found" }, { status: 404 });
  }

  const org = isOrganizationId(store)
    ? await getOrganizationById(store)
    : await getOrganizationBySlug(store);
  if (!org) {
    return NextResponse.json({ error: "Payment link not found" }, { status: 404 });
  }

  const qr = await getQRPointByOrgAndSlug(org.id, item);
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

  const hostHeader = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
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
