import "server-only";

import type { NextRequest } from "next/server";
import { computeCheckoutExpiresAt } from "@/lib/checkout/expiration";
import { CHECKOUT_NO_SETTLE_TO_ERROR, isCheckoutSettleReady } from "@/lib/checkout/ready";
import { resolveCheckoutSettleToAddress } from "@/lib/checkout/settle-to";
import { payerCheckoutUrl } from "@/lib/dashboard/payment-link";
import { createCheckoutSession } from "@/lib/db/checkout-sessions";
import { getOrganizationById } from "@/lib/db/organizations";

/**
 * A fresh Sozu-wallet checkout for a standing payment link or an open amount.
 * Does not expire other charges and does not retarget other links.
 * The wallet host follows the pay host so staging does not open the production wallet.
 */
function isUniqueViolation(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /duplicate key|unique constraint|23505/i.test(message);
}

function requestHost(request?: NextRequest, hostHeader?: string | null): string | null {
  return hostHeader ?? request?.headers.get("x-forwarded-host") ?? request?.headers.get("host") ?? null;
}

export async function mintReusableCheckout(params: {
  orgId: string;
  amountUsd: string;
  reference: string;
  fxSource: string;
  /** Locks one numbered collectible, for example edition:liquid-society:6/10. */
  idempotencyKey?: string;
  /** Item slug, so the receipt can load the photo on that payment link. */
  sourceSlug?: string;
  request?: NextRequest;
  hostHeader?: string | null;
}): Promise<
  | { ok: true; id: string; checkoutUrl: string; walletCheckoutUrl: string }
  | { ok: false; status: number; error: string; conflict?: boolean }
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
  const walletCheckoutUrl = payerCheckoutUrl(
    id,
    requestHost(params.request, params.hostHeader),
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
      providerUrl: walletCheckoutUrl,
      fxSource: params.fxSource,
      idempotencyKey: params.idempotencyKey,
      sourceSlug: params.sourceSlug,
      expiresAt: computeCheckoutExpiresAt(),
      paymentMethod: "sozu",
    });
  } catch (err) {
    if (params.idempotencyKey && isUniqueViolation(err)) {
      return { ok: false, status: 409, error: "Could not start this payment", conflict: true };
    }
    console.error("[checkout] mint reusable error:", err);
    return { ok: false, status: 503, error: "Could not start this payment" };
  }

  return { ok: true, id, checkoutUrl: walletCheckoutUrl, walletCheckoutUrl };
}
