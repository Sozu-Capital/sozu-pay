import { NextRequest, NextResponse } from "next/server";
import { attachSessionCookie } from "@/lib/auth/establish-session";
import { getSession, setSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";
import { clearUserOrgId, getUserBySessionId, promoteOrgCreator } from "@/lib/db/users";
import { createOrganization, getOrgIdsByTreasuryPublicKey, getOrganizationById, getOrgIdsManagedByUser } from "@/lib/db/organizations";
import { addOrgMember, getOrgIdsForUser, upsertOrgMember } from "@/lib/db/org-members";
import { createOrgInvites, type OrgInviteRole } from "@/lib/db/org-invites";
import {
  applyOrganizationSozuTag,
  resolveAvailableOrgSozuTagFromName,
} from "@/lib/org-sozu-tag";
import {
  parseTaxEntityType,
  trimOrNull,
  type OrgTaxProfile,
} from "@/lib/org-tax";
import { createOrgTreasuryProvisioner } from "@/lib/pollar/org-treasury";
import { isPollarMappedUser } from "@/lib/pollar/session-bridge";
import { usableClassicTreasuryPublicKey } from "@/lib/pollar/types";
import { resolveCreateOrganizationType } from "@/lib/org/resolve-create-type";
import { staffTreasuryAlreadyBound, staffGForNewOrg } from "@/lib/org/accessible-orgs";
import { matchingOwnedOrg } from "@/lib/org/onboarding-flags";
import { randomUUID } from "crypto";

/**
 * POST /api/profile/org
 * Create an organization for the current user.
 *
 * Smart-account flow: creates org, promotes creator to super_admin + allowed.
 * Treasury provisioning (disbursement contract) runs via POST /api/profile/org/provision-treasury
 * after passkey smart wallet registration during onboarding.
 *
 * Body: { name?, type?, tax?, guardianThreshold?, invites?, sozuTag? }
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
  const taxBody = body.tax && typeof body.tax === "object" ? (body.tax as Record<string, unknown>) : null;
  const taxEntity = taxBody ? parseTaxEntityType(taxBody.entityType) : null;
  const taxProfile: OrgTaxProfile | null = taxBody
    ? {
        entityType: taxEntity,
        legalName: trimOrNull(taxBody.legalName, 200),
        taxId: trimOrNull(taxBody.taxId, 64),
        registeredAddress: trimOrNull(taxBody.registeredAddress, 300),
        city: trimOrNull(taxBody.city, 120),
        state: trimOrNull(taxBody.state, 120),
        country: trimOrNull(taxBody.country, 80),
      }
    : null;

  const requestedType =
    body.type === "store" || body.type === "ngo" ? (body.type as "store" | "ngo") : undefined;

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
  const pollarPath = isPollarMappedUser(activeUser);
  const type = resolveCreateOrganizationType({
    requestedType,
    taxEntity,
    pollarPath,
  });

  try {
    const existingIds = [
      ...new Set(
        [
          activeUser.org_id,
          ...(await getOrgIdsManagedByUser(activeUser.id)),
          ...(await getOrgIdsForUser(activeUser.id)),
        ].filter((id): id is string => typeof id === "string" && id.length > 0),
      ),
    ];
    const existingOrgs = (
      await Promise.all(existingIds.map((id) => getOrganizationById(id)))
    ).filter((row): row is NonNullable<typeof row> => row != null);
    const already = matchingOwnedOrg(existingOrgs, name);
    if (already) {
      const nextSession = { ...session, orgId: already.id };
      try {
        await setSession(nextSession);
      } catch {
        // non-fatal
      }
      return attachSessionCookie(
        NextResponse.json({
          ok: true,
          organization: { id: already.id, name: already.name, type: already.type },
          reused: true,
          redirect: pollarPath ? "/dashboard" : undefined,
        }),
        nextSession,
      );
    }

    let treasuryPublicKey: string | null = null;
    if (pollarPath) {
      // Optional client-supplied G (from Pollar session); else provisioner uses creator.stellar_public_key
      const bodyTreasury =
        typeof body.treasuryPublicKey === "string" ? body.treasuryPublicKey.trim() : "";
      const fromBody = usableClassicTreasuryPublicKey(bodyTreasury);
      if (fromBody) {
        treasuryPublicKey = fromBody;
      } else {
        const provisioner = createOrgTreasuryProvisioner();
        const provisioned = await provisioner.provisionForCreator(activeUser);
        // Never persist the fake Pollar sentinel — it cannot receive or sign.
        treasuryPublicKey = usableClassicTreasuryPublicKey(provisioned.publicKey);
      }
    }

    if (pollarPath && treasuryPublicKey) {
      const claimed = await getOrgIdsByTreasuryPublicKey(treasuryPublicKey);
      treasuryPublicKey = staffGForNewOrg({
        staffPublicKey: treasuryPublicKey,
        alreadyBound: staffTreasuryAlreadyBound(claimed),
      });
    }

    const org = await createOrganization({
      name,
      type,
      tax: pollarPath ? null : taxProfile,
      treasury_manager_user_id: activeUser.id,
      treasury_guardian_threshold: pollarPath ? 1 : guardianThreshold,
      stellar_disbursement_public_key: treasuryPublicKey,
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

    const ownerMembership = await upsertOrgMember(activeUser.id, org.id, "owner");
    if (!ownerMembership.ok) {
      console.warn("[profile/org] addOrgMember:", ownerMembership.error);
    }
    if (activeUser.org_id && activeUser.org_id !== org.id) {
      const previous = await addOrgMember(activeUser.id, activeUser.org_id, "owner");
      if (!previous.ok) {
        console.warn("[profile/org] preserve previous org membership:", previous.error);
      }
    }

    const nextSession = { ...session, orgId: org.id };
    try {
      await setSession(nextSession);
    } catch {
      // non-fatal
    }

    if (
      pollarPath &&
      !usableClassicTreasuryPublicKey(treasuryPublicKey) &&
      process.env.STELLAR_NETWORK !== "public"
    ) {
      try {
        const { provisionOrgTestnetClassicDisbursement } = await import(
          "@/lib/stellar/provisionOrgTestnetDisbursement"
        );
        const funded = await provisionOrgTestnetClassicDisbursement(org.id);
        treasuryPublicKey = funded?.publicKey ?? null;
      } catch (e) {
        console.warn("[profile/org] testnet treasury provision failed:", e);
        return attachSessionCookie(
          NextResponse.json(
            {
              error:
                e instanceof Error
                  ? e.message
                  : "Could not provision a testnet Org treasury wallet.",
              code: "TREASURY_PROVISION_FAILED",
              organization: { id: org.id, name: org.name, type: org.type },
            },
            { status: 502 },
          ),
          nextSession,
        );
      }
    }

    if (pollarPath && !usableClassicTreasuryPublicKey(treasuryPublicKey)) {
      return attachSessionCookie(
        NextResponse.json(
          {
            error:
              "Could not bind a real Org treasury wallet. Sign in again with Pollar so your Staff wallet is linked.",
            organization: { id: org.id, name: org.name, type: org.type },
          },
          { status: 422 },
        ),
        nextSession,
      );
    }

    let sozuTag: { username: string; tag: string } | null = null;
    const explicitTag = sozuTagRaw.trim();
    let tagToApply = explicitTag;
    // Pollar onboarding: org display name becomes the Sozu tag when the client omits one.
    if (!tagToApply && pollarPath) {
      tagToApply = (await resolveAvailableOrgSozuTagFromName(name)) ?? "";
    }
    if (tagToApply) {
      const tagRes = await applyOrganizationSozuTag({ orgId: org.id, usernameRaw: tagToApply });
      if (!tagRes.ok) {
        // Org row already exists. Never 409/422 the whole create — retrying
        // "name/tag already taken" remounts the type picker and mints ghost orgs.
        console.warn("[profile/org] sozu tag apply failed:", tagRes.error);
        return attachSessionCookie(
          NextResponse.json({
            ok: true,
            organization: { id: org.id, name: org.name, type: org.type },
            guardianThreshold: pollarPath ? 1 : guardianThreshold,
            invitesCount: invites.length,
            sozu_tag_error: tagRes.error,
            ...(treasuryPublicKey && {
              org_treasury_wallet: treasuryPublicKey,
              treasury_source: "creator_staff_pollar_wallet",
            }),
            redirect: pollarPath ? "/dashboard" : undefined,
          }),
          nextSession,
        );
      }
      sozuTag = { username: tagRes.username, tag: `$${tagRes.username}` };
    }

    if (pollarPath && usableClassicTreasuryPublicKey(treasuryPublicKey)) {
      try {
        const { ensureSpendableXlmForFees } = await import("@/lib/stellar/fund");
        const fee = await ensureSpendableXlmForFees(treasuryPublicKey!);
        if (fee.error) {
          console.warn("[profile/org] fee XLM ensure failed:", fee.error);
        }
      } catch (e) {
        console.warn("[profile/org] fee XLM ensure error:", e);
      }
    }

    return attachSessionCookie(
      NextResponse.json({
        ok: true,
        organization: { id: org.id, name: org.name, type: org.type },
        guardianThreshold: pollarPath ? 1 : guardianThreshold,
        invitesCount: invites.length,
        ...(sozuTag && { sozu_tag: sozuTag }),
        ...(treasuryPublicKey && {
          org_treasury_wallet: treasuryPublicKey,
          treasury_source: "creator_staff_pollar_wallet",
        }),
        redirect: pollarPath ? "/dashboard" : undefined,
      }),
      nextSession
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to create organization";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
