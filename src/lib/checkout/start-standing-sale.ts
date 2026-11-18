import "server-only";

import {
  editionClaimKey,
  editionCollectibleName,
  editionHoldIsActive,
  nextEditionNumber,
  parseEditionClaim,
} from "@/lib/dashboard/collectible-edition";
import { standingLinkFxSource } from "@/lib/dashboard/payment-link";
import { mintReusableCheckout } from "@/lib/checkout/mint-reusable-checkout";
import {
  listCollectibleEditionSessions,
  releaseStaleCollectibleEdition,
} from "@/lib/db/checkout-sessions";

const SOLD_OUT = "Esta edición ya no tiene números libres.";

export type StandingSaleResult =
  | {
      ok: true;
      id: string;
      checkoutUrl: string;
      walletCheckoutUrl: string;
      reference: string;
      editionNumber: number | null;
      editionSize: number | null;
    }
  | { ok: false; status: number; error: string };

/**
 * Opens one checkout for a standing link.
 * A numbered collectible, such as the 10 Liquid Society tees, keeps the same URL
 * and claims the next free shirt number for this sale.
 */
export async function startStandingSale(params: {
  orgId: string;
  slug: string;
  name: string;
  amountUsd: string;
  collectibleReceipt: boolean;
  editionSize: number | null;
  hostHeader?: string | null;
}): Promise<StandingSaleResult> {
  const fxSource = standingLinkFxSource(params.collectibleReceipt);
  if (!params.collectibleReceipt || !params.editionSize) {
    const minted = await mintReusableCheckout({
      orgId: params.orgId,
      amountUsd: params.amountUsd,
      reference: params.name,
      fxSource,
      sourceSlug: params.slug,
      hostHeader: params.hostHeader,
    });
    if (!minted.ok) return { ok: false, status: minted.status, error: minted.error };
    return {
      ok: true,
      id: minted.id,
      checkoutUrl: minted.checkoutUrl,
      walletCheckoutUrl: minted.checkoutUrl,
      reference: params.name,
      editionNumber: null,
      editionSize: null,
    };
  }

  const size = params.editionSize;
  for (let attempt = 0; attempt < size; attempt += 1) {
    const now = new Date();
    let sessions;
    try {
      sessions = await listCollectibleEditionSessions(params.orgId, params.slug);
    } catch (err) {
      console.error("[edition] list error:", err);
      return { ok: false, status: 503, error: "Could not start this payment" };
    }

    for (const session of sessions) {
      const hold = {
        status: session.status,
        deletedAt: session.deleted_at,
        expiresAt: session.expires_at,
      };
      if (!editionHoldIsActive(hold, now)) {
        await releaseStaleCollectibleEdition(session, now);
      }
    }

    const taken: number[] = [];
    for (const session of sessions) {
      if (
        !editionHoldIsActive(
          { status: session.status, deletedAt: session.deleted_at, expiresAt: session.expires_at },
          now,
        )
      ) {
        continue;
      }
      const claim = parseEditionClaim(session.idempotency_key);
      if (claim && claim.slug === params.slug) taken.push(claim.number);
    }

    const number = nextEditionNumber(size, taken);
    if (number == null) return { ok: false, status: 409, error: SOLD_OUT };

    const reference = editionCollectibleName(params.name, number, size);
    const minted = await mintReusableCheckout({
      orgId: params.orgId,
      amountUsd: params.amountUsd,
      reference,
      fxSource,
      idempotencyKey: editionClaimKey(params.slug, number, size),
      sourceSlug: params.slug,
      hostHeader: params.hostHeader,
    });
    if (minted.ok) {
      return {
        ok: true,
        id: minted.id,
        checkoutUrl: minted.checkoutUrl,
        walletCheckoutUrl: minted.checkoutUrl,
        reference,
        editionNumber: number,
        editionSize: size,
      };
    }
    if (minted.conflict) continue;
    return { ok: false, status: minted.status, error: minted.error };
  }

  return { ok: false, status: 409, error: SOLD_OUT };
}
