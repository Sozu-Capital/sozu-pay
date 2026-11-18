import { parseEditionClaim } from "@/lib/dashboard/collectible-edition";
import { parseStandingLink } from "@/lib/dashboard/payment-link";

export type CheckoutProductImagePoint = {
  slug: string;
  name: string;
  imageUrl: string | null;
  destinationRef: string | null;
};

/** Public path for the photo a merchant attached to a payment link. */
export function productImagePath(orgId: string, slug: string): string {
  return `/api/public/stores/${encodeURIComponent(orgId)}/items/${encodeURIComponent(slug)}/image`;
}

export function productImageUrl(origin: string, orgId: string, slug: string): string {
  return `${origin.replace(/\/$/, "")}${productImagePath(orgId, slug)}`;
}

/**
 * The standing payment link that minted this checkout.
 * Numbered editions keep the item slug on the claim key. Other links match the item name.
 */
export function matchingQrPointForCheckout(
  session: { reference: string | null; idempotency_key: string | null },
  points: readonly CheckoutProductImagePoint[],
): CheckoutProductImagePoint | null {
  const claim = parseEditionClaim(session.idempotency_key);
  if (claim) {
    return points.find((point) => point.slug === claim.slug) ?? null;
  }
  const name = session.reference?.trim();
  if (!name) return null;
  const standing = points.filter(
    (point) => point.name === name && parseStandingLink(point.destinationRef),
  );
  return standing.find((point) => point.imageUrl) ?? standing[0] ?? null;
}

export function checkoutProductImageUrl(
  origin: string,
  orgId: string,
  session: { reference: string | null; idempotency_key: string | null },
  points: readonly CheckoutProductImagePoint[],
): string | null {
  const point = matchingQrPointForCheckout(session, points);
  if (!point?.imageUrl) return null;
  return productImageUrl(origin, orgId, point.slug);
}
