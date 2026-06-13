import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getUserBySessionId } from "@/lib/db/users";
import { getOrganizationForUser } from "@/lib/db/organizations";
import { resolveOrgReceiveAddress } from "@/lib/org-receive-address";
import { createCheckoutSession } from "@/lib/db/checkout-sessions";
import { syncLiveCheckoutForOrg } from "@/lib/db/merchant-qr-points";
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
  const paymentMethod =
    body.paymentMethod === "card" || body.paymentMethod === "bank_transfer"
      ? body.paymentMethod
      : undefined;
  const allowDebit = typeof body.allowDebit === "boolean" ? body.allowDebit : true;
  const allowCredit = typeof body.allowCredit === "boolean" ? body.allowCredit : true;
  const allowBankTransfer = typeof body.allowBankTransfer === "boolean" ? body.allowBankTransfer : true;

  if (!amountUsd || isNaN(parseFloat(amountUsd)) || parseFloat(amountUsd) <= 0) {
    return NextResponse.json({ error: "amountUsd must be a positive number" }, { status: 400 });
  }

  const user = await getUserBySessionId(session.id);
  const orgId = session.orgId ?? user?.org_id ?? null;
  if (!orgId) {
    return NextResponse.json({ error: "No organization associated with this account" }, { status: 403 });
  }

  const org = await getOrganizationForUser(orgId);
  const receive = org ? resolveOrgReceiveAddress(org) : null;
  const destinationAddress =
    receive?.classicG ?? receive?.tagReceiveAddress ?? receive?.sorobanC ?? null;
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
      paymentMethod,
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
      paymentMethod,
      allowDebit,
      allowCredit,
      allowBankTransfer,
    });
  } catch (err) {
    console.error("[checkout/create] DB persist error:", err);
    // Return the URL anyway so the merchant can still share it; a background job or next call can reconcile
  }

  await syncLiveCheckoutForOrg(orgId, id);

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
