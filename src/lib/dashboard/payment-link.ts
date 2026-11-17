import { normalizeEditionSize } from "@/lib/dashboard/collectible-edition";

/** Standing payment link: title → slug, fixed USD price, payable many times. */

export const STANDING_PRICE_PREFIX = "price:";
export const STANDING_LINK_FX_SOURCE = "STANDING_LINK";
/** Same reusable charge, but the payer keeps a collectible proof of purchase. */
export const STANDING_LINK_COLLECTIBLE_FX_SOURCE = "STANDING_LINK_COLLECTIBLE";
export const OPEN_AMOUNT_FX_SOURCE = "OPEN_AMOUNT";

export type PaymentLinkProductKind = "drink" | "product";

/**
 * Drinks never become collectibles. Other products do only when the merchant
 * turns the collectible receipt toggle on.
 */
export function resolveCollectibleReceipt(
  kind: PaymentLinkProductKind,
  toggleOn: boolean,
): boolean {
  return kind === "product" && toggleOn;
}

export function parsePaymentLinkProductKind(raw: unknown): PaymentLinkProductKind {
  return raw === "drink" ? "drink" : "product";
}

export function standingLinkFxSource(collectibleReceipt: boolean): string {
  return collectibleReceipt ? STANDING_LINK_COLLECTIBLE_FX_SOURCE : STANDING_LINK_FX_SOURCE;
}

export function isCollectibleCheckout(fxSource: string | null | undefined): boolean {
  return fxSource === STANDING_LINK_COLLECTIBLE_FX_SOURCE;
}

export function reusableChargeSources(): readonly string[] {
  return [STANDING_LINK_FX_SOURCE, STANDING_LINK_COLLECTIBLE_FX_SOURCE, OPEN_AMOUNT_FX_SOURCE];
}

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

export type StandingLinkOffer = {
  amountUsd: string;
  productKind: PaymentLinkProductKind;
  collectibleReceipt: boolean;
  /** Set for a numbered run that shares this URL. Null for an open collectible such as the 5-panel. */
  editionSize: number | null;
};

function editionSizeFromMarks(marks: readonly string[], collectibleReceipt: boolean): number | null {
  if (!collectibleReceipt) return null;
  for (const mark of marks) {
    if (!mark.startsWith("edition:")) continue;
    const size = normalizeEditionSize(mark.slice("edition:".length));
    if (size) return size;
  }
  return null;
}

/** `price:12.50`, `price:4.50|drink`, `price:8.00|collectible`, or `price:15.00|collectible|edition:10`. */
export function standingPriceRef(
  amountUsd: string,
  options?: {
    productKind?: PaymentLinkProductKind;
    collectibleReceipt?: boolean;
    editionSize?: number | null;
  },
): string {
  const productKind = options?.productKind ?? "product";
  const collectibleReceipt = resolveCollectibleReceipt(
    productKind,
    options?.collectibleReceipt ?? false,
  );
  const editionSize = collectibleReceipt ? normalizeEditionSize(options?.editionSize) : null;
  let ref = `${STANDING_PRICE_PREFIX}${amountUsd}`;
  if (productKind === "drink") ref += "|drink";
  else if (collectibleReceipt) {
    ref += "|collectible";
    if (editionSize) ref += `|edition:${editionSize}`;
  }
  return ref;
}

export function parseStandingLink(ref: string | null | undefined): StandingLinkOffer | null {
  if (!ref || !ref.startsWith(STANDING_PRICE_PREFIX)) return null;
  const [amountRaw, ...marks] = ref.slice(STANDING_PRICE_PREFIX.length).split("|");
  const amountUsd = normalizeUsdAmount(amountRaw);
  if (!amountUsd) return null;
  const productKind: PaymentLinkProductKind = marks.includes("drink") ? "drink" : "product";
  const collectibleReceipt = resolveCollectibleReceipt(productKind, marks.includes("collectible"));
  return {
    amountUsd,
    productKind,
    collectibleReceipt,
    editionSize: editionSizeFromMarks(marks, collectibleReceipt),
  };
}

export function parseStandingPriceUsd(ref: string | null | undefined): string | null {
  return parseStandingLink(ref)?.amountUsd ?? null;
}

/** POS "new sale" expires other one-shot checkouts. Reusable charges stay pending. */
export function isReusableCharge(fxSource: string | null | undefined): boolean {
  return fxSource != null && reusableChargeSources().includes(fxSource);
}
