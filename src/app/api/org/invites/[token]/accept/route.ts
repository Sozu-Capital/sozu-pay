import { NextRequest, NextResponse } from "next/server";
import { attachSessionCookie } from "@/lib/auth/establish-session";
import { getSession, setSession } from "@/lib/auth/session";
import { getUserBySessionId } from "@/lib/db/users";
import { acceptStaffInvite } from "@/lib/org/accept-staff-invite";
import { isPollarMappedUser } from "@/lib/pollar/session-bridge";

/**
 * POST /api/org/invites/[token]/accept
 * Authenticated Pollar user joins org with invite role — no email match.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { error: "Sign in with Google to accept this invite.", code: "UNAUTHORIZED" },
      { status: 401 },
    );
  }

  const user = await getUserBySessionId(session.id);
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (!isPollarMappedUser(user)) {
    return NextResponse.json(
      { error: "Staff invites require Google Pollar login.", code: "POLLAR_REQUIRED" },
      { status: 400 },
    );
  }

  const { token: raw } = await params;
  const token = decodeURIComponent(raw ?? "").trim();
  if (!token) {
    return NextResponse.json({ error: "token required", code: "NOT_FOUND" }, { status: 404 });
  }

  const result = await acceptStaffInvite({ token, user });
  if (!result.ok) {
    const status =
      result.code === "NOT_FOUND" ? 404 : result.code === "ALREADY_USED" || result.code === "EXPIRED" ? 410 : 400;
    return NextResponse.json({ error: result.message, code: result.code }, { status });
  }

  const nextSession = { ...session, orgId: result.orgId };
  await setSession(nextSession);

  return attachSessionCookie(
    NextResponse.json({
      ok: true,
      orgId: result.orgId,
      role: result.role,
      redirect: "/dashboard",
    }),
    nextSession,
  );
}
