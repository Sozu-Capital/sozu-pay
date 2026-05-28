import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getUserByPrivyId, setActivationRequested } from "@/lib/db/users";

/**
 * POST /api/profile/request-activation – user requests profile/wallet activation by admin.
 * Stores session.orgId when present so approval can assign them as org admin for that org.
 */
export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await getUserByPrivyId(session.id);
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (user.allowed) {
    return NextResponse.json(
      { error: "Your profile is already activated." },
      { status: 400 }
    );
  }

  const updated = await setActivationRequested(session.id);
  if (!updated) {
    return NextResponse.json(
      { error: "Failed to submit activation request." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    activation_requested_at: updated.activation_requested_at,
  });
}
