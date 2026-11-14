import "server-only";

import type { NextRequest } from "next/server";
import { computeCheckoutExpiresAt } from "@/lib/checkout/expiration";
import { CHECKOUT_NO_SETTLE_TO_ERROR, isCheckoutSettleReady } from "@/lib/checkout/ready";
import { resolveCheckoutSettleToAddress } from "@/lib/checkout/settle-to";
import { payerCheckoutUrl } from "@/lib/dashboard/payment-link";
import { createCheckoutSession } from "@/lib/db/checkout-sessions";
import { getOrganizationById } from "@/lib/db/organizations";

function requestHost(request?: NextRequest): string | null {
  return request?.headers.get("x-forwarded-host") ?? request?.headers.get("host") ?? null;
}

/**
 * A fresh checkout for a standing payment link or an open amount.
 * Opens the wallet's testnet checkout. Does not expire other charges.
 */
export async function mintReusableCheckout(params: {
  orgId: string;
  amountUsd: string;
  reference: string;
  fxSource: string;
  request?: NextRequest;
}): Promise<
  | { ok: true; id: string; checkoutUrl: string }
  | { ok: false; status: number; error: string }
> {
  const org = await getOrganizationById(params.orgId);
  if (!isCheckoutSettleReady(org)) {
    return { ok: false, status: 422, error: CHECKOUT_NO_SETTLE_TO_ERROR };
  }
  const destination = resolveCheckoutSettleToAddress(org!);
  if (!destination) {
    return { ok: false, status: 422, error: CHECKOUT_NO_SETTLE_TO_ERROR };
  }

  const id = `cs_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const checkoutUrl = payerCheckoutUrl(
    id,
    requestHost(params.request),
    process.env.NEXT_PUBLIC_SOZU_WALLET_URL,
  );

  try {
    await createCheckoutSession({
      id,
      orgId: params.orgId,
      amountUsd: params.amountUsd,
      reference: params.reference.slice(0, 160),
      destinationStellarAddress: destination,
      providerSessionId: `sozu_${id}`,
      providerUrl: checkoutUrl,
      fxSource: params.fxSource,
      expiresAt: computeCheckoutExpiresAt(),
    });
  } catch (err) {
    console.error("[checkout] mint reusable error:", err);
    return { ok: false, status: 503, error: "Could not start this payment" };
  }

  return { ok: true, id, checkoutUrl };
}
