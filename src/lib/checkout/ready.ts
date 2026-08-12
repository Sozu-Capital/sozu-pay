import type { Organization } from "@/lib/db/organizations";
import { resolveCheckoutSettleToAddress } from "@/lib/checkout/settle-to";

/** Matches POST /api/checkout/create when settle-to is null. Do not change the string. */
export const CHECKOUT_NO_SETTLE_TO_ERROR =
  "Organization has no Stellar disbursement wallet configured";

export const CHECKOUT_SETUP_WALLET_PATH = "/onboarding/setup-smart-wallet";

/** Org destination ready for Checkout / POS — settle-to helper, not user trustline-status. */
export function isCheckoutSettleReady(org: Organization | null): boolean {
  return org != null && resolveCheckoutSettleToAddress(org) != null;
}

/** POST /api/checkout/create uses 422 when settle-to is missing. */
export function isCheckoutWalletNotReadyHttpStatus(status: number): boolean {
  return status === 422;
}
