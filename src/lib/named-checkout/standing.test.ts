import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  effectiveStandingCheckoutState,
  isPosExpireTarget,
  standingSaleRetiresOffer,
} from "./standing.js";
import { namedCheckoutPayerDestination, storeLandingDestination } from "./payer.js";
import { inactiveNamedCheckoutDestination } from "./urls.js";

const noon = Date.parse("2026-08-21T12:00:00.000Z");

describe("effectiveStandingCheckoutState", () => {
  it("is live until the merchant turns it off or the deadline hits", () => {
    assert.equal(effectiveStandingCheckoutState({ live: true, now: noon }), "live");
    assert.equal(
      effectiveStandingCheckoutState({
        live: true,
        deadlineAt: "2026-08-21T12:00:00.000Z",
        now: noon,
      }),
      "expired",
    );
    assert.equal(
      effectiveStandingCheckoutState({
        live: true,
        deadlineAt: "2026-08-21T12:00:01.000Z",
        now: noon,
      }),
      "live",
    );
    assert.equal(effectiveStandingCheckoutState({ live: false, deadlineAt: null, now: noon }), "off");
  });
});

describe("standing sale vs POS expire", () => {
  it("does not retire the Named Checkout URL after a sale", () => {
    assert.equal(standingSaleRetiresOffer(), false);
  });

  it("does not let POS expire-others select standing offers", () => {
    assert.equal(isPosExpireTarget("standing"), false);
    assert.equal(isPosExpireTarget("pos-session"), true);
  });
});

describe("namedCheckoutPayerDestination", () => {
  it("404s only when the store slug is unknown", () => {
    assert.deepEqual(
      namedCheckoutPayerDestination({
        storeKnown: false,
        storeSlug: "ghost",
        checkoutSlug: "almuerzo",
        checkout: { live: true },
      }),
      { kind: "not-found" },
    );
  });

  it("sends inactive or missing checkouts to the store landing", () => {
    assert.deepEqual(
      namedCheckoutPayerDestination({
        storeKnown: true,
        storeSlug: "maria_cafe",
        checkoutSlug: "almuerzo",
        checkout: { live: false },
      }),
      {
        kind: "store-landing",
        storeSlug: "maria_cafe",
        redirect: "/maria_cafe",
      },
    );
    assert.deepEqual(
      namedCheckoutPayerDestination({
        storeKnown: true,
        storeSlug: "maria_cafe",
        checkoutSlug: "missing",
        checkout: null,
      }),
      {
        kind: "store-landing",
        storeSlug: "maria_cafe",
        redirect: "/maria_cafe",
      },
    );
    assert.equal(inactiveNamedCheckoutDestination("maria_cafe"), "/maria_cafe");
  });

  it("pays a live standing offer", () => {
    assert.deepEqual(
      namedCheckoutPayerDestination({
        storeKnown: true,
        storeSlug: "maria_cafe",
        checkoutSlug: "almuerzo",
        checkout: { live: true, deadlineAt: "2099-01-01T00:00:00.000Z" },
        now: noon,
      }),
      { kind: "pay", storeSlug: "maria_cafe", checkoutSlug: "almuerzo" },
    );
  });
});

describe("storeLandingDestination", () => {
  it("redirects an old Store slug to the current landing", () => {
    assert.deepEqual(
      storeLandingDestination({
        storeKnown: true,
        requestedSlug: "old_shop",
        currentSlug: "maria_cafe",
      }),
      { kind: "redirect", storeSlug: "maria_cafe", redirect: "/maria_cafe" },
    );
  });

  it("is not-found when no store owns the slug", () => {
    assert.deepEqual(
      storeLandingDestination({
        storeKnown: false,
        requestedSlug: "ghost",
        currentSlug: null,
      }),
      { kind: "not-found" },
    );
  });
});
