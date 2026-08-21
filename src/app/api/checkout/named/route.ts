import { NextRequest, NextResponse } from "next/server";
import { findOrgByStoreSlug } from "@/lib/db/store-slugs";
import { getStandingCheckoutBySlug, listStandingCheckoutsForOrg } from "@/lib/db/standing-checkouts";
import {
  effectiveStandingCheckoutState,
  namedCheckoutPayerDestination,
  namedCheckoutPath,
  namedCheckoutWalletBody,
  normalizePublicSlug,
  storeLandingDestination,
  storeLandingWalletBody,
  type WalletLiveOffer,
} from "@/lib/named-checkout";

function liveOffersForOrg(
  storeSlug: string,
  rows: Awaited<ReturnType<typeof listStandingCheckoutsForOrg>>,
  now = Date.now(),
): WalletLiveOffer[] {
  return rows
    .filter(
      (row) =>
        effectiveStandingCheckoutState({
          live: row.live,
          deadlineAt: row.deadline_at,
          now,
        }) === "live",
    )
    .map((row) => ({
      checkoutSlug: row.checkout_slug,
      amountUsd: row.amount_usd,
      path: namedCheckoutPath(storeSlug, row.checkout_slug),
    }));
}

/**
 * GET /api/checkout/named?store=&checkout=
 * Public JSON for Sozu Wallet. Follow `redirect` when kind is store-landing.
 */
export async function GET(request: NextRequest) {
  const storeRaw = request.nextUrl.searchParams.get("store") ?? "";
  const checkoutRaw = request.nextUrl.searchParams.get("checkout");
  const storeSlug = normalizePublicSlug(storeRaw);
  if (!storeSlug) {
    return NextResponse.json({ kind: "not-found" }, { status: 404 });
  }

  const match = await findOrgByStoreSlug(storeSlug);
  if (!match) {
    return NextResponse.json({ kind: "not-found" }, { status: 404 });
  }

  if (!checkoutRaw) {
    const dest = storeLandingDestination({
      storeKnown: true,
      requestedSlug: storeSlug,
      currentSlug: match.currentSlug,
    });
    const rows = await listStandingCheckoutsForOrg(match.org.id);
    const { status, body } = storeLandingWalletBody(dest, {
      storeName: match.org.name,
      liveOffers: liveOffersForOrg(match.currentSlug, rows),
    });
    return NextResponse.json(body, { status });
  }

  if (match.requestedIsPrevious) {
    const dest = namedCheckoutPayerDestination({
      storeKnown: true,
      storeSlug: match.currentSlug,
      checkoutSlug: "ignored",
      checkout: null,
    });
    const { status, body } = namedCheckoutWalletBody(dest, { storeName: match.org.name });
    return NextResponse.json(body, { status });
  }

  const checkoutSlug = normalizePublicSlug(checkoutRaw);
  if (!checkoutSlug) {
    const dest = namedCheckoutPayerDestination({
      storeKnown: true,
      storeSlug: match.currentSlug,
      checkoutSlug: "invalid",
      checkout: null,
    });
    const { status, body } = namedCheckoutWalletBody(dest, { storeName: match.org.name });
    return NextResponse.json(body, { status });
  }

  const standing = await getStandingCheckoutBySlug(match.org.id, checkoutSlug);
  const dest = namedCheckoutPayerDestination({
    storeKnown: true,
    storeSlug: match.currentSlug,
    checkoutSlug,
    checkout: standing
      ? { live: standing.live, deadlineAt: standing.deadline_at }
      : null,
  });
  const { status, body } = namedCheckoutWalletBody(dest, {
    storeName: match.org.name,
    amountUsd: standing?.amount_usd,
  });
  return NextResponse.json(body, { status });
}
