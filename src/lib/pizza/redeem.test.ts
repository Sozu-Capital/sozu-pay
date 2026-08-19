import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Keypair } from "@stellar/stellar-sdk";
import type { Organization } from "../db/organizations.js";
import { resolveCheckoutSettleToAddress } from "../checkout/settle-to.js";
import {
  PIZZA_REDEEM_AMOUNT,
  buildPizzaRedeemTransfer,
  pizzaRedeemCompletesCheckoutSession,
  pizzaRedeemWalletSignUrl,
} from "./redeem.js";

const CIRCLE_USDC_SAC = "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA";

function org(overrides: Partial<Organization> = {}): Organization {
  return {
    id: "org-pizzeria",
    name: "Benfranklin Pizzeria",
    type: "store",
    stellar_disbursement_public_key: null,
    stellar_disbursement_secret_encrypted: null,
    recovery_encrypted_secret: null,
    soroban_contract_id: null,
    treasury_contract_id: null,
    treasury_guardian_threshold: null,
    treasury_manager_user_id: null,
    referral_code: null,
    sozu_tag_auth_user_id: null,
    treasury_smart_account_address: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

const PIZZA_ID = "CDLIQJFEKJ4HGDQ7I5KOAVXOIZLCMVVICRMPK2LL3GE6PL53BQWGS4F6";
const GUEST = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";

describe("buildPizzaRedeemTransfer", () => {
  it("builds transfer of exactly 1 PIZZA (0 decimals) to the store settle-to", () => {
    const store = "CXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX";
    const call = buildPizzaRedeemTransfer({
      pizzaTokenId: PIZZA_ID,
      guestAddress: GUEST,
      storeSettleTo: store,
    });
    assert.equal(call.contractId, PIZZA_ID);
    assert.equal(call.method, "transfer");
    assert.equal(call.from, GUEST);
    assert.equal(call.to, store);
    assert.equal(call.amount, 1n);
    assert.equal(PIZZA_REDEEM_AMOUNT, 1);
    assert.notEqual(call.contractId, CIRCLE_USDC_SAC);
  });

  it("uses the merchant settle-to address (treasury smart account first)", () => {
    const sa = "CXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX";
    const classic = Keypair.random().publicKey();
    const dest = resolveCheckoutSettleToAddress(
      org({
        type: "store",
        stellar_disbursement_public_key: classic,
        treasury_smart_account_address: sa,
      }),
    );
    assert.equal(dest, sa);
    const call = buildPizzaRedeemTransfer({
      pizzaTokenId: PIZZA_ID,
      guestAddress: GUEST,
      storeSettleTo: dest!,
    });
    assert.equal(call.to, sa);
  });
});

describe("pizza redeem checkout isolation", () => {
  it("never completes a checkout_session", () => {
    assert.equal(pizzaRedeemCompletesCheckoutSession(), false);
  });
});

describe("pizzaRedeemWalletSignUrl", () => {
  it("points at the wallet origin with intent and return_to, not pay.sozu.capital WebAuthn", () => {
    const url = pizzaRedeemWalletSignUrl({
      walletOrigin: "https://app.sozu.capital",
      intentId: "intent-1",
      returnTo: "https://pay.sozu.capital/pay/qr/margherita-nfc?intent=intent-1",
    });
    assert.equal(
      url,
      "https://app.sozu.capital/auth?intent=intent-1&return_to=https%3A%2F%2Fpay.sozu.capital%2Fpay%2Fqr%2Fmargherita-nfc%3Fintent%3Dintent-1",
    );
    assert.doesNotMatch(url, /pay\.sozu\.capital\/sign/);
  });
});
