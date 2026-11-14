import { NextRequest, NextResponse } from "next/server";
import { searchStoresByName } from "@/lib/db/store-directory";

/** GET /api/public/stores?q= — find a store by name. */
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q") ?? "";
  const stores = await searchStoresByName(q);
  return NextResponse.json({ stores });
}
