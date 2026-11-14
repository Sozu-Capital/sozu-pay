import { NextResponse } from "next/server";
import { getStoreProfile } from "@/lib/db/store-directory";

type Params = { params: Promise<{ id: string }> };

/** GET /api/public/stores/[id] — store name and items currently for sale. */
export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const store = await getStoreProfile(id);
  if (!store) {
    return NextResponse.json({ error: "Store not found" }, { status: 404 });
  }
  return NextResponse.json({ store });
}
