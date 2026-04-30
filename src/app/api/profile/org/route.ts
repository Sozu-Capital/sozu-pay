import { NextRequest, NextResponse } from "next/server";
import { getSession, setSession } from "@/lib/auth/session";
import { clearUserOrgId, getOrCreateUserByPrivy, updateUserOrgId } from "@/lib/db/users";
import { createOrganization, getOrganizationById } from "@/lib/db/organizations";
import { createOrgInvites, type OrgInviteRole } from "@/lib/db/org-invites";
import { applyOrganizationSozuTag } from "@/lib/org-sozu-tag";
import { isUserDerivedEncrypted } from "@/lib/org-wallet-encryption";
import { provisionOrgTestnetClassicDisbursement } from "@/lib/stellar/provisionOrgTestnetDisbursement";
import { randomUUID } from "crypto";

/**
 * POST /api/profile/org
 * Create an organization for the current user.
 *
 * Smart-account flow: creates an org and sets up invite roles for passkey-based treasury management.
 * Body:
 * - { name?, type?, guardianThreshold?, invites? } for basic create
 * - Optional wallet fields (secure create):
 *   { publicKey, encryptedSecret (v1), recoveryEncryptedSecret? (v1) }
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Ensure the user exists (new email logins should be able to create an org).
  // We also allow creating a new organization even if the user is currently linked to one;
  // the new org becomes the active org for this user.
  let user = await getOrCreateUserByPrivy(session.id, session.email);
  if (user.org_id) {
    const existingOrg = await getOrganizationById(user.org_id);
    // If the org link is stale, clear it; otherwise keep it (we'll overwrite after create).
    if (!existingOrg) {
      const cleared = await clearUserOrgId(session.id);
      if (!cleared) {
        return NextResponse.json(
          { error: "Failed to clear stale organization link." },
          { status: 500 }
        );
      }
      user = cleared;
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

  const publicKey = typeof body.publicKey === "string" ? body.publicKey.trim() : "";
  const encryptedSecret =
    typeof body.encryptedSecret === "string" ? body.encryptedSecret.trim() : "";
  const recoveryEncryptedSecret =
    typeof body.recoveryEncryptedSecret === "string" ? body.recoveryEncryptedSecret.trim() : "";
  const sozuTagRaw = typeof body.sozuTag === "string" ? body.sozuTag : "";

  const wantsWallet = !!publicKey || !!encryptedSecret || !!recoveryEncryptedSecret;
  if (wantsWallet) {
    if (!publicKey || !encryptedSecret) {
      return NextResponse.json(
        { error: "publicKey and encryptedSecret are required when setting an org wallet." },
        { status: 400 }
      );
    }
    if (!isUserDerivedEncrypted(encryptedSecret)) {
      return NextResponse.json(
        { error: "encryptedSecret must be user-derived format (v1)." },
        { status: 400 }
      );
    }
    if (recoveryEncryptedSecret && !isUserDerivedEncrypted(recoveryEncryptedSecret)) {
      return NextResponse.json(
        { error: "recoveryEncryptedSecret must be user-derived format (v1)." },
        { status: 400 }
      );
    }
  }

  try {
    const org = await createOrganization({
      name,
      type,
      treasury_manager_user_id: user.id,
      treasury_guardian_threshold: guardianThreshold,
      stellar_disbursement_public_key: wantsWallet ? publicKey : null,
      stellar_disbursement_secret_encrypted: wantsWallet ? encryptedSecret : null,
      recovery_encrypted_secret: wantsWallet
        ? recoveryEncryptedSecret || null
        : null,
    });

    /** MVP testnet: one org disbursement G-address, Friendbot + USDC trustline, secret stored server-side encrypted. */
    let testnetDisbursement: {
      public_key: string;
      friendbot_tx_hash?: string;
      trustline_tx_hash?: string;
    } | null = null;
    // Always provision on testnet so tag creation can't fail on missing org address.
    // This overwrites any client-provided wallet for MVP simplicity.
    {
      const provisioned = await provisionOrgTestnetClassicDisbursement(org.id);
      if (provisioned) {
        testnetDisbursement = {
          public_key: provisioned.publicKey,
          friendbot_tx_hash: provisioned.friendbotHash,
          trustline_tx_hash: provisioned.trustlineHash,
        };
      }
    }

    if (invites.length > 0) {
      const inviteRows = invites.map((i) => ({
        email: i.email,
        role: i.role,
        token: randomUUID(),
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString(), // 14 days
      }));
      const created = await createOrgInvites({ orgId: org.id, invites: inviteRows });
      if (!created.ok) {
        return NextResponse.json({ error: created.error ?? "Failed to create invites" }, { status: 500 });
      }
    }

    const linked = await updateUserOrgId(session.id, org.id);
    if (!linked) {
      return NextResponse.json(
        { error: "Failed to link organization to user." },
        { status: 500 }
      );
    }

    try {
      await setSession({ ...session, orgId: org.id });
    } catch {
      // non-fatal: sozu-tag resolves org from user.org_id first
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
      ...(testnetDisbursement && { testnet_disbursement: testnetDisbursement }),
      ...(sozuTag && { sozu_tag: sozuTag }),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to create organization";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
