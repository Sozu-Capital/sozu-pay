import { NextRequest, NextResponse } from "next/server";
import { getSession, setSession } from "@/lib/auth/session";
import { clearUserOrgId, getUserBySessionId, promoteOrgCreator } from "@/lib/db/users";
import { createOrganization, getOrganizationById } from "@/lib/db/organizations";
import { createOrgInvites, type OrgInviteRole } from "@/lib/db/org-invites";
import { applyOrganizationSozuTag } from "@/lib/org-sozu-tag";
import { randomUUID } from "crypto";

/**
 * POST /api/profile/org
 * Create an organization for the current user.
 *
 * Smart-account flow: creates org, promotes creator to super_admin + allowed.
 * Treasury provisioning (disbursement contract) runs via POST /api/profile/org/provision-treasury
 * after passkey smart wallet registration during onboarding.
 *
 * Body: { name?, type?, guardianThreshold?, invites?, sozuTag? }
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await getUserBySessionId(session.id);
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  let activeUser = user;
  if (activeUser.org_id) {
    const existingOrg = await getOrganizationById(activeUser.org_id);
    if (!existingOrg) {
      const cleared = await clearUserOrgId(session.id);
      if (!cleared) {
        return NextResponse.json(
          { error: "Failed to clear stale organization link." },
          { status: 500 }
        );
      }
      activeUser = cleared;
    }
  }

  const body = await request.json().catch(() => ({}));
  const name =
    typeof body.name === "string" && body.name.trim()
      ? body.name.trim()
      : "My organization";
  const type =
    body.type === "store" || body.type === "ngo" ? body.type : "ngo";

  const guardianThresholdRaw =
    typeof body.guardianThreshold === "number" ? body.guardianThreshold : null;
  const guardianThreshold =
    guardianThresholdRaw != null && Number.isInteger(guardianThresholdRaw) && guardianThresholdRaw >= 1
      ? guardianThresholdRaw
      : 2;

  const invitesInput = Array.isArray(body.invites) ? (body.invites as unknown[]) : [];
  const invites = invitesInput
    .map((x) => x as { email?: unknown; role?: unknown })
    .map((x) => ({
      email: typeof x.email === "string" ? x.email.trim().toLowerCase() : "",
      role: typeof x.role === "string" ? x.role : "member",
    }))
    .filter((x) => x.email.includes("@")) as Array<{ email: string; role: OrgInviteRole }>;

  const sozuTagRaw = typeof body.sozuTag === "string" ? body.sozuTag : "";

  try {
    const org = await createOrganization({
      name,
      type,
      treasury_manager_user_id: activeUser.id,
      treasury_guardian_threshold: guardianThreshold,
    });

    if (invites.length > 0) {
      const inviteRows = invites.map((i) => ({
        email: i.email,
        role: i.role,
        token: randomUUID(),
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString(),
      }));
      const created = await createOrgInvites({ orgId: org.id, invites: inviteRows });
      if (!created.ok) {
        return NextResponse.json({ error: created.error ?? "Failed to create invites" }, { status: 500 });
      }
    }

    const linked = await promoteOrgCreator(session.id, org.id);
    if (!linked) {
      return NextResponse.json(
        { error: "Failed to link organization to user." },
        { status: 500 }
      );
    }

    try {
      await setSession({ ...session, orgId: org.id });
    } catch {
      // non-fatal
    }

    let sozuTag: { username: string; tag: string } | null = null;
    if (sozuTagRaw.trim()) {
      const tagRes = await applyOrganizationSozuTag({ orgId: org.id, usernameRaw: sozuTagRaw });
      if (!tagRes.ok) {
        return NextResponse.json({ error: tagRes.error }, { status: tagRes.status });
      }
      sozuTag = { username: tagRes.username, tag: `$${tagRes.username}` };
    }

    return NextResponse.json({
      ok: true,
      organization: { id: org.id, name: org.name, type: org.type },
      guardianThreshold,
      invitesCount: invites.length,
      ...(sozuTag && { sozu_tag: sozuTag }),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to create organization";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
