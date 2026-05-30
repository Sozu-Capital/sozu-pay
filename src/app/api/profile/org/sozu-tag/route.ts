import { NextRequest, NextResponse } from "next/server";
import { getSession, setSession } from "@/lib/auth/session";
import { getUserByPrivyId } from "@/lib/db/users";
import { getOrganizationById } from "@/lib/db/organizations";
import { applyOrganizationSozuTag, getOrganizationSozuTag } from "@/lib/org-sozu-tag";
import { getOrgReceiveDiagnostics } from "@/lib/org-receive-address";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await getUserByPrivyId(session.id);
  /** Prefer DB org (source of truth); session.orgId can be stale after org create/switch. */
  const orgId = user?.org_id ?? session.orgId ?? null;
  if (!orgId) return NextResponse.json({ error: "No organization." }, { status: 404 });

  if (session.orgId !== orgId) {
    try {
      await setSession({ ...session, orgId });
    } catch {
      // non-fatal
    }
  }

  const org = await getOrganizationById(orgId);
  if (!org) return NextResponse.json({ error: "Organization not found." }, { status: 404 });

  const username = await getOrganizationSozuTag(org);
  const diagnostics = await getOrgReceiveDiagnostics(org);
  return NextResponse.json({
    username,
    tag: username ? `$${username}` : null,
    sozu_tag_auth_user_id: org.sozu_tag_auth_user_id ?? null,
    receive: diagnostics.receive,
    tag_directory_public_key: diagnostics.tagDirectoryPublicKey,
    warnings: diagnostics.warnings,
    classic_on_network: diagnostics.classicOnNetwork,
    has_usdc_trustline: diagnostics.hasUsdcTrustline,
  });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await getUserByPrivyId(session.id);
  if (!user) return NextResponse.json({ error: "User not found." }, { status: 404 });
  if (user.admin_level !== "admin" && user.admin_level !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const orgId = user.org_id ?? session.orgId ?? null;
  if (!orgId) return NextResponse.json({ error: "No organization." }, { status: 404 });

  if (session.orgId !== orgId) {
    try {
      await setSession({ ...session, orgId });
    } catch {
      // non-fatal
    }
  }

  const body = await request.json().catch(() => ({}));
  const usernameRaw = typeof body.username === "string" ? body.username : "";
  const res = await applyOrganizationSozuTag({ orgId, usernameRaw });
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });

  return NextResponse.json({
    ok: true,
    username: res.username,
    tag: `$${res.username}`,
    sozu_tag_auth_user_id: res.sozuTagAuthUserId,
  });
}

