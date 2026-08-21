/**
 * Expo wallet contract tests.
 *
 * Sozu Wallet (Expo) copies these parse rules for QR / pasted pay.sozu.capital URLs.
 * Expected values are the contract literals from `.scratch/named-checkout-and-auth/expo-wallet-contract.md`.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { namedCheckoutUrl, storeLandingUrl } from "./urls.js";
import { isPaySozuCheckoutHost, parsePaySozuPath, parsePaySozuUrl } from "./parse.js";
import { namedCheckoutPayerDestination } from "./payer.js";

describe("Named Checkout URL anatomy", () => {
  it("keeps store name and checkout name on pay.sozu.capital, not the wallet host", () => {
    const prev = process.env.NEXT_PUBLIC_APP_URL;
    process.env.NEXT_PUBLIC_APP_URL = "https://pay.sozu.capital";
    try {
      assert.equal(
        namedCheckoutUrl("maria_cafe", "almuerzo"),
        "https://pay.sozu.capital/maria_cafe/almuerzo",
      );
      assert.equal(storeLandingUrl("maria_cafe"), "https://pay.sozu.capital/maria_cafe");
    } finally {
      if (prev === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
      else process.env.NEXT_PUBLIC_APP_URL = prev;
    }
  });
});

describe("parsePaySozuPath — wallet QR / paste contract", () => {
  it("parses a Named Checkout URL", () => {
    assert.deepEqual(parsePaySozuPath("/maria_cafe/almuerzo"), {
      kind: "named-checkout",
      storeSlug: "maria_cafe",
      checkoutSlug: "almuerzo",
    });
  });

  it("parses a Store landing page", () => {
    assert.deepEqual(parsePaySozuPath("/maria_cafe"), {
      kind: "store-landing",
      storeSlug: "maria_cafe",
    });
  });

  it("keeps POS checkout and success on /checkout/{id}", () => {
    assert.deepEqual(parsePaySozuPath("/checkout/cs_test"), {
      kind: "pos-checkout",
      sessionId: "cs_test",
    });
    assert.deepEqual(parsePaySozuPath("/checkout/cs_test/success"), {
      kind: "pos-success",
      sessionId: "cs_test",
    });
  });

  it("keeps merchant QR and pizza SKU routes", () => {
    assert.deepEqual(parsePaySozuPath("/pay/qr/till-1"), {
      kind: "merchant-qr",
      slug: "till-1",
    });
    assert.deepEqual(parsePaySozuPath("/checkout/pizza/margherita-nfc"), {
      kind: "pizza-sku",
      slug: "margherita-nfc",
    });
  });

  it("does not treat product routes as stores", () => {
    assert.deepEqual(parsePaySozuPath("/dashboard"), { kind: "reserved" });
    assert.deepEqual(parsePaySozuPath("/checkout"), { kind: "reserved" });
    assert.deepEqual(parsePaySozuPath("/auth/pollar/callback"), { kind: "reserved" });
  });
});

describe("parsePaySozuUrl — host rules", () => {
  it("accepts pay.sozu.capital and rejects the wallet host as a checkout host", () => {
    const named = parsePaySozuUrl("https://pay.sozu.capital/maria_cafe/almuerzo");
    assert.equal(named.kind, "named-checkout");
    assert.equal(named.checkoutHost, true);

    const wallet = parsePaySozuUrl("https://credit.sozu.capital/maria_cafe/almuerzo");
    assert.equal(wallet.kind, "named-checkout");
    assert.equal(wallet.checkoutHost, false);
    assert.equal(isPaySozuCheckoutHost("credit.sozu.capital"), false);
    assert.equal(isPaySozuCheckoutHost("app.sozu.capital"), false);
    assert.equal(isPaySozuCheckoutHost("pay.sozu.capital"), true);
  });

  it("parses a path-only scan the same as a full URL", () => {
    assert.deepEqual(parsePaySozuUrl("/maria_cafe/almuerzo").kind, "named-checkout");
  });
});

describe("inactive Named Checkout URL — wallet follow-redirect contract", () => {
  it("tells the wallet to open the store landing, not a dead-end", () => {
    const dest = namedCheckoutPayerDestination({
      storeKnown: true,
      storeSlug: "maria_cafe",
      checkoutSlug: "almuerzo",
      checkout: { live: false },
    });
    assert.equal(dest.kind, "store-landing");
    if (dest.kind === "store-landing") {
      assert.equal(dest.redirect, "/maria_cafe");
    }
  });
});
