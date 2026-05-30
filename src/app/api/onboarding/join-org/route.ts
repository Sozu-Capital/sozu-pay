import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getUserBySessionId } from "@/lib/db/users";
import { getOrganizationByReferralCode } from "@/lib/db/organizations";
import { addOrgMember } from "@/lib/db/org-members";

/**
 * POST /api/onboarding/join-org – join an organization by referral code.
 * Body: { code: string }. Adds current user to org_members for the org with that referral_code.
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const code = typeof body.code === "string" ? body.code.trim() : "";
  if (!code) {
    return NextResponse.json({ error: "Referral code is required" }, { status: 400 });
  }

  const user = await getUserBySessionId(session.id);
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const org = await getOrganizationByReferralCode(code);
  if (!org) {
    return NextResponse.json({ error: "Invalid or expired referral code" }, { status: 404 });
  }

  const result = await addOrgMember(user.id, org.id, "member");
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error ?? "Failed to join organization" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    organization: { id: org.id, name: org.name, type: org.type },
  });
}
