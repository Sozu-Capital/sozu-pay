import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getUserBySessionId } from "@/lib/db/users";
import { getOrganizationForUser } from "@/lib/db/organizations";
import { createCheckoutSession } from "@/lib/db/checkout-sessions";
import { rampProvider } from "@/lib/ramp/provider";

/**
 * POST /api/checkout/create
 * Creates a checkout session: persists to DB, calls ramp provider, returns URL.
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const amountUsd = typeof body.amountUsd === "string" ? body.amountUsd.trim() : "";
  const reference = typeof body.reference === "string" ? body.reference.trim() : undefined;

  if (!amountUsd || isNaN(parseFloat(amountUsd)) || parseFloat(amountUsd) <= 0) {
    return NextResponse.json({ error: "amountUsd must be a positive number" }, { status: 400 });
  }

  const user = await getUserBySessionId(session.id);
  const orgId = session.orgId ?? user?.org_id ?? null;
  if (!orgId) {
    return NextResponse.json({ error: "No organization associated with this account" }, { status: 403 });
  }

  const org = await getOrganizationForUser(orgId);
  const destinationAddress = org?.stellar_disbursement_public_key ?? null;
  if (!destinationAddress) {
    return NextResponse.json(
      { error: "Organization has no Stellar disbursement wallet configured" },
      { status: 422 },
    );
  }

  const id = `cs_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const redirectUrl = `${baseUrl}/checkout/${id}/success`;

  let depositSession;
  try {
    depositSession = await rampProvider.createDepositSession({
      orgId,
      amountUsd,
      destinationStellarAddress: destinationAddress,
      externalRef: id,
      redirectUrl,
    });
  } catch (err) {
    console.error("[checkout/create] ramp provider error:", err);
    return NextResponse.json({ error: "Failed to create deposit session" }, { status: 502 });
  }

  try {
    await createCheckoutSession({
      id,
      orgId,
      amountUsd,
      reference,
      destinationStellarAddress: destinationAddress,
      providerSessionId: depositSession.sessionId,
      providerUrl: depositSession.url,
      providerExpiresAt: depositSession.expiresAt,
    });
  } catch (err) {
    console.error("[checkout/create] DB persist error:", err);
    // Return the URL anyway so the merchant can still share it; a background job or next call can reconcile
  }

  const checkoutUrl = `${baseUrl}/checkout/${id}`;

  return NextResponse.json({
    id,
    checkoutUrl,
    amountUsd,
    reference: reference ?? null,
    providerSessionId: depositSession.sessionId,
    expiresAt: depositSession.expiresAt ?? null,
  });
}
