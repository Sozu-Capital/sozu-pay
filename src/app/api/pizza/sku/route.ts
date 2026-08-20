import { NextRequest, NextResponse } from "next/server";
import { getQRPointBySlug } from "@/lib/db/merchant-qr-points";
import { getOrganizationById } from "@/lib/db/organizations";
import { getWalletOrigin } from "@/lib/pizza/redeem";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": getWalletOrigin(),
    "Access-Control-Allow-Methods": "GET, OPTIONS",
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
 * GET /api/pizza/sku?slug=
 * Public standing pizza SKU for the wallet store-checkout UI.
 */
export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get("slug")?.trim().toLowerCase() ?? "";
  if (!slug || !/^[a-z0-9_-]+$/.test(slug)) {
    return json({ error: "slug is required" }, 400);
  }

  const qr = await getQRPointBySlug(slug);
  if (!qr || qr.destinationType !== "pizza_sku") {
    return json({ error: "Pizza SKU not found" }, 404);
  }

  const org = await getOrganizationById(qr.orgId);
  return json({
    slug: qr.slug,
    name: qr.name,
    merchantName: org?.name ?? "Merchant",
    sku: "Margherita",
    amount: 1,
    asset: "PIZZA",
    online: qr.isOnline,
  });
}
