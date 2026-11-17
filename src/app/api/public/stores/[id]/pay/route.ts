import { NextRequest, NextResponse } from "next/server";
import { OPEN_AMOUNT_FX_SOURCE, normalizeUsdAmount } from "@/lib/dashboard/payment-link";
import { mintReusableCheckout } from "@/lib/checkout/mint-reusable-checkout";
import { startStandingSale } from "@/lib/checkout/start-standing-sale";
import { getStoreProfile } from "@/lib/db/store-directory";

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/public/stores/[id]/pay
 * Body: { amountUsd } — any amount sent to the store's name.
 * Body: { slug } — pay one item on the store profile.
 */
export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const store = await getStoreProfile(id);
  if (!store) {
    return NextResponse.json({ error: "Store not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const slug = typeof body.slug === "string" ? body.slug.trim().toLowerCase() : "";

  if (slug) {
    const item = store.items.find((entry) => entry.slug === slug);
    if (!item) {
      return NextResponse.json({ error: "Item not for sale" }, { status: 404 });
    }
    const minted = await startStandingSale({
      orgId: store.id,
      slug: item.slug,
      name: item.name,
      amountUsd: item.amountUsd,
      collectibleReceipt: item.collectibleReceipt,
      editionSize: item.editionSize,
    });
    if (!minted.ok) {
      return NextResponse.json({ error: minted.error }, { status: minted.status });
    }
    return NextResponse.json({
      id: minted.id,
      amountUsd: item.amountUsd,
      itemName: item.name,
      collectibleReceipt: item.collectibleReceipt,
      editionNumber: minted.editionNumber,
      editionSize: minted.editionSize,
      storeName: store.name,
      walletCheckoutUrl: minted.walletCheckoutUrl,
    });
  }

  const amountUsd = normalizeUsdAmount(body.amountUsd);
  if (!amountUsd) {
    return NextResponse.json({ error: "Enter an amount greater than 0" }, { status: 400 });
  }

  const minted = await mintReusableCheckout({
    orgId: store.id,
    amountUsd,
    reference: store.name,
    fxSource: OPEN_AMOUNT_FX_SOURCE,
  });
  if (!minted.ok) {
    return NextResponse.json({ error: minted.error }, { status: minted.status });
  }

  return NextResponse.json({
    id: minted.id,
    amountUsd,
    itemName: null,
    storeName: store.name,
    walletCheckoutUrl: minted.walletCheckoutUrl,
  });
}
