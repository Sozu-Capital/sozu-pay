import { NextRequest, NextResponse } from "next/server";
import { findOrgByStoreSlug } from "@/lib/db/store-slugs";
import {
  createCheckoutSession,
} from "@/lib/db/checkout-sessions";
import { getStandingCheckoutBySlug } from "@/lib/db/standing-checkouts";
import { isCheckoutSettleReady } from "@/lib/checkout/ready";
import { resolveCheckoutSettleToAddress } from "@/lib/checkout/settle-to";
import { computeCheckoutExpiresAt } from "@/lib/checkout/expiration";
import { rampProvider } from "@/lib/ramp/provider";
import { checkoutSessionUrl, checkoutSuccessUrl } from "@/lib/checkout-url";
import {
  namedCheckoutPayerDestination,
  normalizePublicSlug,
} from "@/lib/named-checkout";

/**
 * POST /api/checkout/named/pay
 * Public: mint a POS payment attempt for a live Standing checkout.
 * Does not expire the standing offer or other standing URLs.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const storeSlug = normalizePublicSlug(
    typeof body?.store === "string" ? body.store : "",
  );
  const checkoutSlug = normalizePublicSlug(
    typeof body?.checkout === "string" ? body.checkout : "",
  );
  if (!storeSlug || !checkoutSlug) {
    return NextResponse.json({ error: "Invalid store or checkout slug" }, { status: 400 });
  }

  const match = await findOrgByStoreSlug(storeSlug);
  if (!match || match.requestedIsPrevious) {
    return NextResponse.json(
      { error: "Not found", redirect: match ? `/${match.currentSlug}` : undefined },
      { status: match ? 409 : 404 },
    );
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
  if (dest.kind !== "pay" || !standing) {
    return NextResponse.json(
      { error: "Inactive checkout", redirect: `/${match.currentSlug}` },
      { status: 409 },
    );
  }

  const org = match.org;
  if (!isCheckoutSettleReady(org)) {
    return NextResponse.json({ error: "Store cannot receive payments yet" }, { status: 422 });
  }

  const id = `cs_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const expiresAt = computeCheckoutExpiresAt();
  const destinationAddress = resolveCheckoutSettleToAddress(org)!;
  const redirectUrl = checkoutSuccessUrl(id, request);

  let depositSession;
  try {
    depositSession = await rampProvider.createDepositSession({
      orgId: org.id,
      amountUsd: standing.amount_usd,
      destinationStellarAddress: destinationAddress,
      externalRef: id,
      redirectUrl,
    });
  } catch (err) {
    console.error("[checkout/named/pay] ramp:", err);
    return NextResponse.json({ error: "Failed to create payment" }, { status: 502 });
  }

  await createCheckoutSession({
    id,
    orgId: org.id,
    amountUsd: standing.amount_usd,
    reference: checkoutSlug,
    destinationStellarAddress: destinationAddress,
    providerSessionId: depositSession.sessionId,
    providerUrl: depositSession.url,
    expiresAt,
    standingCheckoutId: standing.id,
  });

  return NextResponse.json({
    id,
    checkoutUrl: checkoutSessionUrl(id, request),
    amountUsd: standing.amount_usd,
    standingCheckoutId: standing.id,
  });
}
