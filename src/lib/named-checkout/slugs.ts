import { suggestOrgTagFromOrgName } from "@/lib/sozu-tag-suggest";

/** First path segments that are product routes, never a Store slug. */
export const RESERVED_STORE_SLUGS = [
  "api",
  "auth",
  "checkout",
  "credit",
  "dashboard",
  "join",
  "login",
  "merchant",
  "merchants",
  "onboarding",
  "pay",
  "ramp",
  "sdp",
  "sign",
  "_next",
  "favicon.ico",
  "robots.txt",
  "sitemap.xml",
] as const;

const RESERVED = new Set<string>(RESERVED_STORE_SLUGS);

/** Public store / checkout slug: 3–30 chars, [a-z0-9_], matching Org Sozu tag rules. */
export function isPublicSlug(raw: string): boolean {
  return /^[a-z0-9_]{3,30}$/.test(raw);
}

export function normalizePublicSlug(raw: string): string | null {
  const s = raw.trim().replace(/^\$+/, "").toLowerCase();
  if (!isPublicSlug(s)) return null;
  return s;
}

export function isReservedStoreSlug(slug: string): boolean {
  return RESERVED.has(slug.toLowerCase());
}

export function allocateUniqueSlug(
  desired: string,
  taken: ReadonlySet<string>,
): string | null {
  const base = normalizePublicSlug(desired) ?? suggestOrgTagFromOrgName(desired);
  if (!isPublicSlug(base)) return null;

  const trySlug = (candidate: string): string | null => {
    if (!isPublicSlug(candidate)) return null;
    if (isReservedStoreSlug(candidate)) return null;
    if (taken.has(candidate)) return null;
    return candidate;
  };

  const first = trySlug(base);
  if (first) return first;

  for (let n = 2; n <= 99; n++) {
    const suffix = `_${n}`;
    const stem = base.slice(0, Math.max(3, 30 - suffix.length));
    const candidate = `${stem}${suffix}`;
    const ok = trySlug(candidate);
    if (ok) return ok;
  }
  return null;
}

/**
 * Store slug for an Organization: Org Sozu tag when it is a claimable public slug,
 * otherwise a unique slug derived from the display name.
 */
export function storeSlugFromOrg(input: {
  orgSozuTag: string | null | undefined;
  displayName: string;
  taken: ReadonlySet<string>;
}): string | null {
  const tag = input.orgSozuTag ? normalizePublicSlug(input.orgSozuTag) : null;
  if (tag && !isReservedStoreSlug(tag) && !input.taken.has(tag)) return tag;
  return allocateUniqueSlug(input.displayName, input.taken);
}

/** After an Org Sozu tag change, the old slug must keep resolving to this store. */
export function storeSlugAfterTagChange(input: {
  previousSlug: string;
  newTag: string;
}): { current: string; redirectFrom: string } | { error: "reserved" | "invalid" } {
  const current = normalizePublicSlug(input.newTag);
  if (!current) return { error: "invalid" };
  if (isReservedStoreSlug(current)) return { error: "reserved" };
  const previous = normalizePublicSlug(input.previousSlug) ?? input.previousSlug.toLowerCase();
  return { current, redirectFrom: previous };
}
