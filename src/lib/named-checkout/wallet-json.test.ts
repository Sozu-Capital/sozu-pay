import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { namedCheckoutPayerDestination, storeLandingDestination } from "./payer.js";
import { namedCheckoutWalletBody, storeLandingWalletBody } from "./wallet-json.js";

describe("wallet JSON for named URLs", () => {
  it("returns pay with amount for a live Named Checkout URL", () => {
    const dest = namedCheckoutPayerDestination({
      storeKnown: true,
      storeSlug: "maria_cafe",
      checkoutSlug: "almuerzo",
      checkout: { live: true },
    });
    const { status, body } = namedCheckoutWalletBody(dest, {
      storeName: "Maria Cafe",
      amountUsd: "12.00",
    });
    assert.equal(status, 200);
    assert.deepEqual(body, {
      kind: "pay",
      storeSlug: "maria_cafe",
      checkoutSlug: "almuerzo",
      storeName: "Maria Cafe",
      amountUsd: "12.00",
      path: "/maria_cafe/almuerzo",
    });
  });

  it("returns store-landing redirect for an inactive checkout", () => {
    const dest = namedCheckoutPayerDestination({
      storeKnown: true,
      storeSlug: "maria_cafe",
      checkoutSlug: "almuerzo",
      checkout: { live: false },
    });
    const { status, body } = namedCheckoutWalletBody(dest, { storeName: "Maria Cafe" });
    assert.equal(status, 200);
    assert.equal(body.kind, "store-landing");
    if (body.kind === "store-landing") {
      assert.equal(body.redirect, "/maria_cafe");
    }
  });

  it("lists live offers on the store landing JSON", () => {
    const dest = storeLandingDestination({
      storeKnown: true,
      requestedSlug: "maria_cafe",
      currentSlug: "maria_cafe",
    });
    const { status, body } = storeLandingWalletBody(dest, {
      storeName: "Maria Cafe",
      liveOffers: [{ checkoutSlug: "almuerzo", amountUsd: "12.00", path: "/maria_cafe/almuerzo" }],
    });
    assert.equal(status, 200);
    assert.equal(body.kind, "store-landing");
    if (body.kind === "store-landing") {
      assert.equal(body.liveOffers?.[0]?.checkoutSlug, "almuerzo");
    }
  });
});
