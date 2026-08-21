import { getSupabase } from "@/lib/supabase/server";
import type { Organization } from "@/lib/db/organizations";
import { getOrganizationById } from "@/lib/db/organizations";
import {
  isPublicSlug,
  storeSlugFromOrg,
} from "@/lib/named-checkout/slugs";

export type StoreSlugMatch = {
  org: Organization;
  currentSlug: string;
  requestedIsPrevious: boolean;
};

async function orgTagUsername(org: Organization): Promise<string | null> {
  const uid = org.sozu_tag_auth_user_id?.trim() || null;
  if (!uid) return null;
  const { data, error } = await getSupabase()
    .from("profiles")
    .select("username")
    .eq("id", uid)
    .limit(1)
    .maybeSingle();
  if (error) return null;
  const username = (data as { username?: string } | null)?.username;
  return typeof username === "string" && isPublicSlug(username) ? username : null;
}

function orgCurrentSlug(org: Organization, fallbackTag: string | null): string | null {
  const stored = typeof org.store_slug === "string" ? org.store_slug.trim() : "";
  if (isPublicSlug(stored)) return stored;
  if (fallbackTag && isPublicSlug(fallbackTag)) return fallbackTag;
  return null;
}

async function takenStoreSlugs(exceptOrgId?: string): Promise<Set<string>> {
  const { data, error } = await getSupabase()
    .from("organizations")
    .select("id, store_slug, store_slug_previous");
  if (error) return new Set();
  const taken = new Set<string>();
  for (const row of data ?? []) {
    if (exceptOrgId && row.id === exceptOrgId) continue;
    if (typeof row.store_slug === "string" && isPublicSlug(row.store_slug)) {
      taken.add(row.store_slug);
    }
    if (typeof row.store_slug_previous === "string" && isPublicSlug(row.store_slug_previous)) {
      taken.add(row.store_slug_previous);
    }
  }
  return taken;
}

export async function findOrgByStoreSlug(slug: string): Promise<StoreSlugMatch | null> {
  if (!isPublicSlug(slug)) return null;
  const sb = getSupabase();

  const byCurrent = await sb
    .from("organizations")
    .select("*")
    .eq("store_slug", slug)
    .limit(1)
    .maybeSingle();
  if (!byCurrent.error && byCurrent.data) {
    const org = byCurrent.data as Organization;
    const tag = await orgTagUsername(org);
    const currentSlug = orgCurrentSlug(org, tag) ?? slug;
    return { org, currentSlug, requestedIsPrevious: false };
  }

  const byPrevious = await sb
    .from("organizations")
    .select("*")
    .eq("store_slug_previous", slug)
    .limit(1)
    .maybeSingle();
  if (!byPrevious.error && byPrevious.data) {
    const org = byPrevious.data as Organization;
    const tag = await orgTagUsername(org);
    const currentSlug = orgCurrentSlug(org, tag) ?? slug;
    return { org, currentSlug, requestedIsPrevious: currentSlug !== slug };
  }

  const profile = await sb.from("profiles").select("id").eq("username", slug).limit(1).maybeSingle();
  const profileId = (profile.data as { id?: string } | null)?.id;
  if (profileId) {
    const orgRow = await sb
      .from("organizations")
      .select("*")
      .eq("sozu_tag_auth_user_id", profileId)
      .limit(1)
      .maybeSingle();
    if (!orgRow.error && orgRow.data) {
      const org = orgRow.data as Organization;
      const currentSlug = orgCurrentSlug(org, slug) ?? slug;
      return { org, currentSlug, requestedIsPrevious: false };
    }
  }

  return null;
}

export async function updateOrganizationStoreSlug(
  orgId: string,
  storeSlug: string,
  previousSlug?: string | null,
): Promise<Organization | null> {
  const payload: Record<string, unknown> = {
    store_slug: storeSlug,
    updated_at: new Date().toISOString(),
  };
  if (previousSlug !== undefined) payload.store_slug_previous = previousSlug;

  const { data, error } = await getSupabase()
    .from("organizations")
    .update(payload as never)
    .eq("id", orgId)
    .select()
    .single();

  if (error) {
    console.error("[store-slugs] updateOrganizationStoreSlug:", error.message);
    return null;
  }
  return data as Organization;
}

/** Ensure the org has a claimable Store slug; persist when the column exists. */
export async function ensureOrgStoreSlug(orgId: string): Promise<string | null> {
  const org = await getOrganizationById(orgId);
  if (!org) return null;
  const tag = await orgTagUsername(org);
  const existing = orgCurrentSlug(org, tag);
  if (existing && org.store_slug === existing) return existing;

  const taken = await takenStoreSlugs(orgId);
  const slug = storeSlugFromOrg({
    orgSozuTag: tag,
    displayName: org.name,
    taken,
  });
  if (!slug) return existing;

  if (org.store_slug && org.store_slug !== slug) {
    await updateOrganizationStoreSlug(orgId, slug, org.store_slug);
  } else {
    await updateOrganizationStoreSlug(orgId, slug, org.store_slug_previous ?? null);
  }
  return slug;
}

export async function applyStoreSlugForNewTag(
  orgId: string,
  newTag: string,
): Promise<string | null> {
  const org = await getOrganizationById(orgId);
  if (!org) return null;
  const previous = typeof org.store_slug === "string" ? org.store_slug : null;
  const taken = await takenStoreSlugs(orgId);
  const slug = storeSlugFromOrg({
    orgSozuTag: newTag,
    displayName: org.name,
    taken,
  });
  if (!slug) return previous;
  const prev = previous && previous !== slug ? previous : org.store_slug_previous ?? null;
  await updateOrganizationStoreSlug(orgId, slug, prev);
  return slug;
}
