import { isPublicSlug, isReservedStoreSlug, normalizePublicSlug } from "./slugs";

export type PaySozuPath =
  | { kind: "store-landing"; storeSlug: string }
  | { kind: "named-checkout"; storeSlug: string; checkoutSlug: string }
  | { kind: "pos-checkout"; sessionId: string }
  | { kind: "pos-success"; sessionId: string }
  | { kind: "merchant-qr"; slug: string }
  | { kind: "pizza-sku"; slug: string }
  | { kind: "reserved" }
  | { kind: "unknown" };

export type ParsedPaySozuUrl = PaySozuPath & {
  host: string | null;
  checkoutHost: boolean;
};

function stripTrailingSlash(path: string): string {
  if (path.length > 1 && path.endsWith("/")) return path.slice(0, -1);
  return path;
}

function segmentsOf(pathname: string): string[] {
  const path = stripTrailingSlash(pathname.split("?")[0] ?? pathname);
  return path.split("/").filter(Boolean);
}

/**
 * Path-only parse for pay.sozu.capital (and local). Used by the Expo wallet QR scanner.
 */
export function parsePaySozuPath(pathname: string): PaySozuPath {
  const segments = segmentsOf(pathname.startsWith("/") ? pathname : `/${pathname}`);
  if (segments.length === 0) return { kind: "unknown" };

  const first = segments[0]?.toLowerCase() ?? "";
  const second = segments[1]?.toLowerCase();
  const third = segments[2]?.toLowerCase();

  if (first === "checkout" && second === "pizza" && third) {
    return { kind: "pizza-sku", slug: decodeURIComponent(third) };
  }
  if (first === "checkout" && second && third === "success") {
    return { kind: "pos-success", sessionId: decodeURIComponent(second) };
  }
  if (first === "checkout" && second && segments.length === 2) {
    return { kind: "pos-checkout", sessionId: decodeURIComponent(second) };
  }
  if (first === "pay" && second === "qr" && third) {
    return { kind: "merchant-qr", slug: decodeURIComponent(third) };
  }

  if (isReservedStoreSlug(first)) return { kind: "reserved" };

  const storeSlug = normalizePublicSlug(first);
  if (!storeSlug) return { kind: "unknown" };

  if (segments.length === 1) {
    return { kind: "store-landing", storeSlug };
  }

  if (segments.length === 2 && second) {
    const checkoutSlug = normalizePublicSlug(second);
    if (!checkoutSlug || isReservedStoreSlug(checkoutSlug)) {
      return { kind: "unknown" };
    }
    if (!isPublicSlug(checkoutSlug)) return { kind: "unknown" };
    return { kind: "named-checkout", storeSlug, checkoutSlug };
  }

  return { kind: "unknown" };
}

/** credit.sozu.capital is the wallet, never the Named Checkout URL host. */
export function isPaySozuCheckoutHost(host: string): boolean {
  const h = host.trim().toLowerCase().replace(/:\d+$/, "");
  if (!h) return false;
  if (h === "credit.sozu.capital" || h === "app.sozu.capital") return false;
  return true;
}

export function parsePaySozuUrl(href: string): ParsedPaySozuUrl {
  try {
    const url = new URL(href);
    const path = parsePaySozuPath(url.pathname);
    const host = url.host;
    return { ...path, host, checkoutHost: isPaySozuCheckoutHost(host) };
  } catch {
    if (href.startsWith("/")) {
      return { ...parsePaySozuPath(href), host: null, checkoutHost: true };
    }
    return { kind: "unknown", host: null, checkoutHost: false };
  }
}
