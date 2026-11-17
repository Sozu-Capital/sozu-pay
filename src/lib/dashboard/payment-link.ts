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

/** Host that should own this checkout. Prefer the request host so staging stays on dev.pay. */
export function checkoutOriginFromHeaders(
  hostHeader: string | null | undefined,
  protoHeader: string | null | undefined,
  fallback: string,
): string {
  const fallbackOrigin = fallback.replace(/\/$/, "") || "http://localhost:3000";
  const host = hostHeader?.split(",")[0]?.trim();
  if (!host) return fallbackOrigin;
  const proto =
    protoHeader?.split(",")[0]?.trim() ||
    (host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");
  return `${proto}://${host}`;
}

/**
 * Payer wallet for this pay host. Staging must not follow a production wallet
 * env var: app.sozu.capital waitlists /checkout and bounces the payer home.
 */
export function walletOriginForPayHost(
  hostHeader: string | null | undefined,
  envOrigin?: string | null,
): string {
  const host = (hostHeader ?? "").split(",")[0]?.trim().toLowerCase().replace(/:\d+$/, "") ?? "";
  if (host === "dev.pay.sozu.capital") return "https://dev.sozu.capital";
  if (host === "pay.sozu.capital") return "https://app.sozu.capital";
  const env = envOrigin?.trim().replace(/\/$/, "") ?? "";
  if (host === "localhost" || host === "127.0.0.1") {
    return env || "http://localhost:3000";
  }
  if (/^https?:\/\//.test(env)) return env;
  return "https://app.sozu.capital";
}

/** Real testnet checkout: passkey payment on the wallet, not the ramp stub. */
export function payerCheckoutUrl(
  sessionId: string,
  hostHeader: string | null | undefined,
  envOrigin?: string | null,
): string {
  return `${walletOriginForPayHost(hostHeader, envOrigin)}/checkout/${encodeURIComponent(sessionId)}`;
}

export function isStubRampCheckoutUrl(raw: string | null | undefined): boolean {
  if (!raw) return false;
  try {
    return new URL(raw).pathname.startsWith("/ramp/stub-checkout");
  } catch {
    return false;
  }
}

/** Keep a stub checkout on the same host as its success URL. */
export function originOfRedirect(redirectUrl: string, fallback: string): string {
  try {
    const url = new URL(redirectUrl);
    if (url.protocol === "https:" || url.protocol === "http:") return url.origin;
  } catch {
    /* use fallback */
  }
  return fallback.replace(/\/$/, "") || "http://localhost:3000";
}

/** POS "new sale" expires other one-shot checkouts. Reusable charges stay pending. */
export function isReusableCharge(fxSource: string | null | undefined): boolean {
  return fxSource != null && reusableChargeSources().includes(fxSource);
}

const ORGANIZATION_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const STORE_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ITEM_SLUG = /^[a-z0-9_-]+$/;

export function isOrganizationId(value: string): boolean {
  return ORGANIZATION_ID.test(value.trim().toLowerCase());
}

/** Store name slug, or the organization id when the name is not stored yet. */
export function parseStorePathSegment(raw: string): string | null {
  const value = raw.trim().toLowerCase();
  if (ORGANIZATION_ID.test(value) || STORE_SLUG.test(value)) return value;
  return null;
}

/** Public pay path. The store comes first so the item name is not global. */
export function paymentLinkPath(storeSlug: string, itemSlug: string): string | null {
  const store = parseStorePathSegment(storeSlug);
  const item = itemSlug.trim().toLowerCase();
  if (!store || !ITEM_SLUG.test(item)) return null;
  return `/pay/qr/${store}/${item}`;
}
