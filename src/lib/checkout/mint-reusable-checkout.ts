import "server-only";

import { computeCheckoutExpiresAt } from "@/lib/checkout/expiration";
import { CHECKOUT_NO_SETTLE_TO_ERROR, isCheckoutSettleReady } from "@/lib/checkout/ready";
import { resolveCheckoutSettleToAddress } from "@/lib/checkout/settle-to";
import { createCheckoutSession } from "@/lib/db/checkout-sessions";
import { getOrganizationById } from "@/lib/db/organizations";
import { sozuWalletCheckoutUrl } from "@/lib/checkout-url";

/**
 * A fresh Sozu-wallet checkout for a standing payment link or an open amount.
 * Does not expire other charges and does not retarget other links.
 */
export async function mintReusableCheckout(params: {
  orgId: string;
  amountUsd: string;
  reference: string;
  fxSource: string;
}): Promise<
  | { ok: true; id: string; walletCheckoutUrl: string }
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
  const walletCheckoutUrl = sozuWalletCheckoutUrl(id);

  try {
    await createCheckoutSession({
      id,
      orgId: params.orgId,
      amountUsd: params.amountUsd,
      reference: params.reference.slice(0, 160),
      destinationStellarAddress: destination,
      providerSessionId: id,
      providerUrl: walletCheckoutUrl,
      fxSource: params.fxSource,
      expiresAt: computeCheckoutExpiresAt(),
      paymentMethod: "sozu",
    });
  } catch (err) {
    console.error("[checkout] mint reusable error:", err);
    return { ok: false, status: 503, error: "Could not start this payment" };
  }

  return { ok: true, id, walletCheckoutUrl };
}
