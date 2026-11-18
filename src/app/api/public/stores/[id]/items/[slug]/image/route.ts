import { NextResponse } from "next/server";
import { resolvePublicQRPoint } from "@/lib/db/merchant-qr-points";
import { readStoredProductImage } from "@/lib/dashboard/product-image";

type Params = { params: Promise<{ id: string; slug: string }> };

/** GET /api/public/stores/[id]/items/[slug]/image — the product photo on a payment link. */
export async function GET(_request: Request, { params }: Params) {
  const { id, slug } = await params;
  const point = await resolvePublicQRPoint(slug, id);
  const image = readStoredProductImage(point?.imageUrl);
  const match = image?.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/);
  if (!match) return new NextResponse(null, { status: 404 });

  return new NextResponse(new Uint8Array(Buffer.from(match[2], "base64")), {
    headers: {
      "Content-Type": match[1],
      "Cache-Control": "public, max-age=300",
    },
  });
}
