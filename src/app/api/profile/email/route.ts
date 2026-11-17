import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getUserBySessionId, updateUserEmail } from "@/lib/db/users";
import { isPollarMappedUser } from "@/lib/pollar/session-bridge";

/**
 * PATCH /api/profile/email — Pollar staff can update the dashboard contact email.
 * Google sign-in identity is unchanged.
 */
export async function PATCH(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await getUserBySessionId(session.id);
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
  if (!isPollarMappedUser(user)) {
    return NextResponse.json({ error: "Email is managed by your sign-in method." }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email.includes("@") || email.length < 5) {
    return NextResponse.json({ error: "Enter a valid email." }, { status: 400 });
  }

  const updated = await updateUserEmail(user.id, email);
  if (!updated) return NextResponse.json({ error: "Could not update email." }, { status: 500 });
  return NextResponse.json({ ok: true, email: updated.email });
}
