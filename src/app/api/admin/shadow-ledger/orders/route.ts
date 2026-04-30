import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getUserByPrivyId } from "@/lib/db/users";
import { formatOrderForApi, listPendingPaymentOrdersForAdmin } from "@/lib/db/shadow-ledger";

function isAdmin(level: string) {
  return level === "admin" || level === "super_admin";
}

/** GET /api/admin/shadow-ledger/orders — pending payment orders (manual oracle inbox). */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const currentUser = await getUserByPrivyId(session.id);
  if (!currentUser || !isAdmin(currentUser.admin_level)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const rows = await listPendingPaymentOrdersForAdmin(200);
    return NextResponse.json({ orders: rows.map(formatOrderForApi) });
  } catch (err) {
    console.error("[admin/shadow-ledger/orders]", err);
    return NextResponse.json({ error: "Failed to list orders" }, { status: 500 });
  }
}
