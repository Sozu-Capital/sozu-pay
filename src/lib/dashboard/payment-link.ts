/** Standing payment link: title → slug, fixed USD price, payable many times. */

export const STANDING_PRICE_PREFIX = "price:";
export const STANDING_LINK_FX_SOURCE = "STANDING_LINK";
export const OPEN_AMOUNT_FX_SOURCE = "OPEN_AMOUNT";

/** Slug from a title. Lowercase, no accents, [a-z0-9-]. */
export function slugFromTitle(title: string): string {
  const base = title
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return base.length >= 2 ? base : "link";
}

/** Positive USD with at most 2 decimals, stored as "12.50". */
export function normalizeUsdAmount(raw: unknown): string | null {
  const text =
    typeof raw === "number" && Number.isFinite(raw)
      ? String(raw)
      : typeof raw === "string"
        ? raw.trim().replace(",", ".")
        : "";
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return null;
  const n = Number(text);
  if (!(n > 0) || n > 1_000_000) return null;
  return n.toFixed(2);
}

export function standingPriceRef(amountUsd: string): string {
  return `${STANDING_PRICE_PREFIX}${amountUsd}`;
}

export function parseStandingPriceUsd(ref: string | null | undefined): string | null {
  if (!ref || !ref.startsWith(STANDING_PRICE_PREFIX)) return null;
  return normalizeUsdAmount(ref.slice(STANDING_PRICE_PREFIX.length));
}

/** POS "new sale" expires other one-shot checkouts. Reusable charges stay pending. */
export function isReusableCharge(fxSource: string | null | undefined): boolean {
  return fxSource === STANDING_LINK_FX_SOURCE || fxSource === OPEN_AMOUNT_FX_SOURCE;
}
