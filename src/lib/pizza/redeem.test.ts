import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Keypair } from "@stellar/stellar-sdk";
import type { Organization } from "../db/organizations.js";
import { resolveCheckoutSettleToAddress } from "../checkout/settle-to.js";
import {
  PIZZA_REDEEM_AMOUNT,
  buildPizzaRedeemTransfer,
  nextPizzaSkuGuestAction,
  parseStellarTxHash,
  pizzaRedeemClientView,
  pizzaRedeemCompletesCheckoutSession,
  pizzaRedeemWalletSignUrl,
  pizzaWalletCheckoutUrl,
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

const WALLET = "https://app.sozu.capital";
const GUEST_G = "GDW4KDAKWDXTTXKBJ3EPUCXQ47JOURDM3QXV623QIBNFFOO7SJT2ZQ3A";

describe("pizzaWalletCheckoutUrl", () => {
  it("opens the wallet store-checkout route for the standing slug", () => {
    assert.equal(
      pizzaWalletCheckoutUrl({ walletOrigin: WALLET, slug: "margherita-nfc" }),
      "https://app.sozu.capital/checkout/pizza/margherita-nfc",
    );
  });
});

describe("nextPizzaSkuGuestAction", () => {
  it("hops to wallet store checkout, not /auth auto-sign", () => {
    const next = nextPizzaSkuGuestAction({}, { slug: "margherita-nfc", walletOrigin: WALLET });
    assert.equal(next.kind, "hop");
    if (next.kind !== "hop") return;
    const hopped = new URL(next.url);
    assert.equal(hopped.origin, WALLET);
    assert.equal(hopped.pathname, "/checkout/pizza/margherita-nfc");
    assert.equal(hopped.search, "");
  });

  it("does not auto-redeem when a guest bounce-back is present", () => {
    const next = nextPizzaSkuGuestAction(
      { hopped: "1", pizza: "1", guest: GUEST_G },
      { slug: "margherita-nfc", walletOrigin: WALLET },
    );
    assert.equal(next.kind, "hop");
    if (next.kind !== "hop") return;
    assert.equal(next.url, `${WALLET}/checkout/pizza/margherita-nfc`);
  });

  it("keeps an in-flight intent on pay so confirmation can render", () => {
    const next = nextPizzaSkuGuestAction(
      { intent: "intent-1" },
      { slug: "margherita-nfc", walletOrigin: WALLET },
    );
    assert.deepEqual(next, { kind: "intent", intentId: "intent-1" });
  });
});

describe("pizzaRedeemClientView", () => {
  it("exposes the SEP-41 transfer so the wallet can sign 1 PIZZA to settle-to", () => {
    const view = pizzaRedeemClientView({
      id: "intent-1",
      status: "pending",
      amount: 1,
      txHash: null,
      guestAddress: GUEST_G,
      storeAddress: "CXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
      tokenId: PIZZA_ID,
    });
    assert.equal(view.transfer.method, "transfer");
    assert.equal(view.transfer.from, GUEST_G);
    assert.equal(view.transfer.to, "CXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX");
    assert.equal(view.transfer.contractId, PIZZA_ID);
    assert.equal(view.transfer.amount, "1");
    assert.equal(view.completesCheckoutSession, false);
  });
});

describe("parseStellarTxHash", () => {
  it("accepts a 64-char hex hash and rejects placeholders", () => {
    assert.equal(
      parseStellarTxHash("54ee25857cbfa942a2e826fbf2c1d7f9b18f4bf3acc4e89aacf2f695b85d3281"),
      "54ee25857cbfa942a2e826fbf2c1d7f9b18f4bf3acc4e89aacf2f695b85d3281",
    );
    assert.equal(parseStellarTxHash("not-a-hash"), null);
    assert.equal(parseStellarTxHash(""), null);
  });
});

