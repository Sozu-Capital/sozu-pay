import { NextResponse } from "next/server";
import { previewStaffInvite } from "@/lib/org/accept-staff-invite";

/**
 * GET /api/org/invites/[token] — public preview (no email match).
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token: raw } = await params;
  const token = decodeURIComponent(raw ?? "").trim();
  if (!token) {
    return NextResponse.json({ error: "token required", code: "NOT_FOUND" }, { status: 404 });
  }

  const preview = await previewStaffInvite(token);
  if (!preview.ok) {
    const status = preview.code === "NOT_FOUND" ? 404 : 410;
    return NextResponse.json(
      { error: preview.message, code: preview.code },
      { status },
    );
  }

  return NextResponse.json({
    orgId: preview.orgId,
    orgName: preview.orgName,
    role: preview.role,
    expiresAt: preview.expiresAt,
  });
}
