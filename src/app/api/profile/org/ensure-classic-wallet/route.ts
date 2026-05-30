import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getUserBySessionId } from "@/lib/db/users";
import { getOrganizationById } from "@/lib/db/organizations";
import { provisionOrgTestnetClassicDisbursement } from "@/lib/stellar/provisionOrgTestnetDisbursement";
import { applyOrganizationSozuTag, getOrganizationSozuTag } from "@/lib/org-sozu-tag";
import { getOrgReceiveDiagnostics } from "@/lib/org-receive-address";

/**
 * POST /api/profile/org/ensure-classic-wallet
 * Testnet: create classic G disbursement wallet + USDC trustline if missing.
 * Re-syncs Sozu tag → stellar_wallets when a tag already exists.
 */
export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (process.env.STELLAR_NETWORK === "public") {
    return NextResponse.json(
      { error: "Classic auto-provision is only available on testnet." },
      { status: 400 }
    );
  }

  const user = await getUserBySessionId(session.id);
  if (!user) return NextResponse.json({ error: "User not found." }, { status: 404 });
  if (user.admin_level !== "admin" && user.admin_level !== "super_admin") {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const orgId = user.org_id ?? session.orgId ?? null;
  if (!orgId) return NextResponse.json({ error: "No organization." }, { status: 404 });

  const org = await getOrganizationById(orgId);
  if (!org) return NextResponse.json({ error: "Organization not found." }, { status: 404 });

  let classic_public_key = org.stellar_disbursement_public_key?.trim() || null;
  let provisioned = false;

  if (!classic_public_key) {
    try {
      const result = await provisionOrgTestnetClassicDisbursement(orgId);
      if (!result?.publicKey) {
        return NextResponse.json({ error: "Failed to provision classic wallet." }, { status: 502 });
      }
      classic_public_key = result.publicKey;
      provisioned = true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return NextResponse.json({ error: msg }, { status: 502 });
    }
  }

  const tagUsername = await getOrganizationSozuTag(org);
  let tagResynced = false;
  if (tagUsername) {
    const tag = await applyOrganizationSozuTag({ orgId, usernameRaw: tagUsername });
    if (!tag.ok) {
      return NextResponse.json(
        {
          error: tag.error,
          classic_public_key,
          provisioned,
        },
        { status: tag.status }
      );
    }
    tagResynced = true;
  }

  const refreshed = await getOrganizationById(orgId);
  const diagnostics = refreshed ? await getOrgReceiveDiagnostics(refreshed) : null;

  return NextResponse.json({
    ok: true,
    classic_public_key,
    provisioned,
    tag_resynced: tagResynced,
    tag: tagUsername ? `$${tagUsername}` : null,
    diagnostics,
  });
}
