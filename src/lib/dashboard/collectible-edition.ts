import { isCheckoutExpired } from "@/lib/checkout/expiration";

/** A numbered run shares one payment link. Ten shirts is the Liquid Society tee drop. */
export const MAX_EDITION_SIZE = 10_000;

export function normalizeEditionSize(raw: unknown): number | null {
  if (raw == null || raw === "") return null;
  const text =
    typeof raw === "number" && Number.isFinite(raw)
      ? String(raw)
      : typeof raw === "string"
        ? raw.trim()
        : "";
  if (!/^[1-9]\d*$/.test(text)) return null;
  const size = Number(text);
  if (!Number.isInteger(size) || size < 1 || size > MAX_EDITION_SIZE) return null;
  return size;
}

/**
 * Lowest free shirt number in 1..size.
 * A completed sale keeps its number. An abandoned checkout gives the number back.
 */
export function nextEditionNumber(size: number, taken: readonly number[]): number | null {
  if (!Number.isInteger(size) || size < 1) return null;
  const used = new Set(taken.filter((n) => Number.isInteger(n) && n >= 1 && n <= size));
  for (let number = 1; number <= size; number += 1) {
    if (!used.has(number)) return number;
  }
  return null;
}

/** One row per shirt. The org idempotency unique index refuses a second claim of the same number. */
export function editionClaimKey(slug: string, number: number, size: number): string {
  return `edition:${slug}:${number}/${size}`;
}

export function parseEditionClaim(
  key: string | null | undefined,
): { slug: string; number: number; size: number } | null {
  if (!key) return null;
  const match = /^edition:([a-z0-9_-]+):([1-9]\d*)\/([1-9]\d*)$/.exec(key);
  if (!match) return null;
  const number = Number(match[2]);
  const size = Number(match[3]);
  if (number > size || size > MAX_EDITION_SIZE) return null;
  return { slug: match[1], number, size };
}

export function editionClaimFields(key: string | null | undefined): {
  editionNumber: number | null;
  editionSize: number | null;
} {
  const claim = parseEditionClaim(key);
  if (!claim) return { editionNumber: null, editionSize: null };
  return { editionNumber: claim.number, editionSize: claim.size };
}

/** Checkout reference the wallet shows on the collectible, for example "Liquid Society Tee 6/10". */
export function editionCollectibleName(itemName: string, number: number, size: number): string {
  const label = `${number}/${size}`;
  const room = Math.max(1, 160 - label.length - 1);
  const base = itemName.trim().slice(0, room);
  return `${base} ${label}`;
}

export function editionHoldIsActive(
  session: { status: string; deletedAt?: string | null; expiresAt?: string | null },
  now: Date | number = Date.now(),
): boolean {
  if (session.deletedAt) return false;
  if (session.status === "completed") return true;
  if (session.status !== "pending") return false;
  return !isCheckoutExpired(session.expiresAt, now);
}
