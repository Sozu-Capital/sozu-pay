import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getUserBySessionId } from "@/lib/db/users";
import {
  getOrganizationById,
  updateOrganizationDisbursementPublicKey,
} from "@/lib/db/organizations";
import { resolveCanonicalActiveOrgId } from "@/lib/db/org-members";
import {
  applyOrganizationSozuTag,
  getOrganizationSozuTag,
  resyncOrganizationSozuTagDirectory,
} from "@/lib/org-sozu-tag";
import { getOrgReceiveDiagnostics } from "@/lib/org-receive-address";
import { isPollarMappedUser } from "@/lib/pollar/session-bridge";
import {
  isFakePollarStaffWallet,
  usableClassicTreasuryPublicKey,
} from "@/lib/pollar/types";

/** Replace stub Pollar treasury G with the creator's real Staff wallet when available. */
async function repairFakePollarTreasuryIfNeeded(
  orgId: string,
  creatorStellarPublicKey: string | null | undefined,
) {
  const org = await getOrganizationById(orgId);
  if (!org || !isFakePollarStaffWallet(org.stellar_disbursement_public_key)) {
    return org;
  }
  const real = usableClassicTreasuryPublicKey(creatorStellarPublicKey);
  if (!real) return org;
  return (await updateOrganizationDisbursementPublicKey(orgId, real)) ?? org;
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await getUserBySessionId(session.id);
  const orgId = user
    ? await resolveCanonicalActiveOrgId({
        userId: user.id,
        primaryOrgId: user.org_id,
        sessionOrgId: session.orgId,
        staffPublicKey: user.stellar_public_key,
      })
    : session.orgId ?? null;
  if (!orgId) return NextResponse.json({ error: "No organization." }, { status: 404 });

  let org = await getOrganizationById(orgId);
  if (!org) return NextResponse.json({ error: "Organization not found." }, { status: 404 });

  if (user && isPollarMappedUser(user)) {
    org = (await repairFakePollarTreasuryIfNeeded(orgId, user.stellar_public_key)) ?? org;
  }

  const resync = await resyncOrganizationSozuTagDirectory(orgId);
  if (resync.resynced) {
    const refreshed = await getOrganizationById(orgId);
    if (refreshed) org = refreshed;
  }

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
    tag_directory_resynced: resync.resynced,
    ...(resync.error && { tag_directory_resync_error: resync.error }),
  });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await getUserBySessionId(session.id);
  if (!user) return NextResponse.json({ error: "User not found." }, { status: 404 });
  if (user.admin_level !== "admin" && user.admin_level !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const orgId = await resolveCanonicalActiveOrgId({
    userId: user.id,
    primaryOrgId: user.org_id,
    sessionOrgId: session.orgId,
    staffPublicKey: user.stellar_public_key,
  });
  if (!orgId) return NextResponse.json({ error: "No organization." }, { status: 404 });

  if (isPollarMappedUser(user)) {
    await repairFakePollarTreasuryIfNeeded(orgId, user.stellar_public_key);
  }

  const body = await request.json().catch(() => ({}));
  const usernameRaw = typeof body.username === "string" ? body.username : "";
  await resyncOrganizationSozuTagDirectory(orgId);

  const res = await applyOrganizationSozuTag({ orgId, usernameRaw });
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });

  const org = await getOrganizationById(orgId);
  const diagnostics = org ? await getOrgReceiveDiagnostics(org) : null;

  return NextResponse.json({
    ok: true,
    username: res.username,
    tag: `$${res.username}`,
    sozu_tag_auth_user_id: res.sozuTagAuthUserId,
    tag_receive_address: diagnostics?.receive.tagReceiveAddress ?? null,
    tag_directory_public_key: diagnostics?.tagDirectoryPublicKey ?? null,
    warnings: diagnostics?.warnings ?? [],
  });
}
