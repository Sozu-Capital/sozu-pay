import type { NamedCheckoutPayerDestination, StoreLandingDestination } from "./payer";

export type WalletLiveOffer = {
  checkoutSlug: string;
  amountUsd: string;
  path: string;
};

export type NamedCheckoutWalletBody =
  | { kind: "not-found" }
  | {
      kind: "store-landing";
      storeSlug: string;
      redirect: string;
      storeName?: string;
      liveOffers?: WalletLiveOffer[];
    }
  | {
      kind: "pay";
      storeSlug: string;
      checkoutSlug: string;
      storeName?: string;
      amountUsd: string;
      path: string;
    };

export function namedCheckoutWalletBody(
  dest: NamedCheckoutPayerDestination,
  extras?: { storeName?: string; amountUsd?: string },
): { status: 200 | 404; body: NamedCheckoutWalletBody } {
  if (dest.kind === "not-found") {
    return { status: 404, body: { kind: "not-found" } };
  }
  if (dest.kind === "store-landing") {
    return {
      status: 200,
      body: {
        kind: "store-landing",
        storeSlug: dest.storeSlug,
        redirect: dest.redirect,
        storeName: extras?.storeName,
      },
    };
  }
  return {
    status: 200,
    body: {
      kind: "pay",
      storeSlug: dest.storeSlug,
      checkoutSlug: dest.checkoutSlug,
      storeName: extras?.storeName,
      amountUsd: extras?.amountUsd ?? "0",
      path: `/${dest.storeSlug}/${dest.checkoutSlug}`,
    },
  };
}

export function storeLandingWalletBody(
  dest: StoreLandingDestination,
  extras?: { storeName?: string; liveOffers?: WalletLiveOffer[] },
): { status: 200 | 404; body: NamedCheckoutWalletBody } {
  if (dest.kind === "not-found") {
    return { status: 404, body: { kind: "not-found" } };
  }
  const storeSlug = dest.storeSlug;
  const redirect = dest.kind === "redirect" ? dest.redirect : `/${storeSlug}`;
  return {
    status: 200,
    body: {
      kind: "store-landing",
      storeSlug,
      redirect,
      storeName: extras?.storeName,
      liveOffers: extras?.liveOffers,
    },
  };
}
