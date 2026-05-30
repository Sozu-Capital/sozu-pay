import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getUserBySessionId } from "@/lib/db/users";
import { formatOrderForApi, getPaymentOrderByPublicRef } from "@/lib/db/shadow-ledger";

/**
 * GET /api/payments/status?publicRef= — order status for merchant org (must own order).
 */
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await getUserBySessionId(session.id);
  if (!user?.org_id) {
    return NextResponse.json({ error: "Organization required" }, { status: 400 });
  }

  const publicRef = request.nextUrl.searchParams.get("publicRef")?.trim();
  if (!publicRef) {
    return NextResponse.json({ error: "Missing publicRef" }, { status: 400 });
  }

  try {
    const order = await getPaymentOrderByPublicRef(publicRef);
    if (!order) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (order.org_id !== user.org_id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ order: formatOrderForApi(order) });
  } catch (err) {
    console.error("[payments/status]", err);
    return NextResponse.json({ error: "Lookup failed" }, { status: 500 });
  }
}
