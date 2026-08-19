import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  destinationRefForQrCreate,
  parseQrPointDestinationType,
  qrPointScanUrl,
  routePayQrPoint,
} from "./merchant-qr.js";

const BASE = "https://pay.sozu.capital";
const COMPLETED_CHECKOUT_ID = "11111111-2222-4333-8444-555555555555";

describe("parseQrPointDestinationType", () => {
  it("accepts pizza_sku as a destination type", () => {
    assert.equal(parseQrPointDestinationType("pizza_sku"), "pizza_sku");
  });

  it("rejects unknown destinations", () => {
    assert.equal(parseQrPointDestinationType("pos"), null);
  });
});

describe("qrPointScanUrl", () => {
  it("encodes the standing /pay/qr/{slug} URL for a pizza SKU, never a checkout id", () => {
    assert.equal(
      qrPointScanUrl(
        {
          slug: "margherita-nfc",
          destinationType: "pizza_sku",
          destinationRef: COMPLETED_CHECKOUT_ID,
        },
        BASE,
      ),
      "https://pay.sozu.capital/pay/qr/margherita-nfc",
    );
  });

  it("encodes the standing slug URL for live checkout points too", () => {
    assert.equal(
      qrPointScanUrl(
        {
          slug: "front-counter",
          destinationType: "checkout",
          destinationRef: COMPLETED_CHECKOUT_ID,
        },
        BASE,
      ),
      "https://pay.sozu.capital/pay/qr/front-counter",
    );
  });
});

describe("destinationRefForQrCreate", () => {
  it("does not attach a checkout session id when creating a pizza SKU", () => {
    assert.equal(
      destinationRefForQrCreate({
        destinationType: "pizza_sku",
        destinationRef: COMPLETED_CHECKOUT_ID,
        latestCheckoutId: COMPLETED_CHECKOUT_ID,
      }),
      undefined,
    );
  });

  it("still links live checkout points to the latest pending session", () => {
    assert.equal(
      destinationRefForQrCreate({
        destinationType: "checkout",
        latestCheckoutId: COMPLETED_CHECKOUT_ID,
      }),
      COMPLETED_CHECKOUT_ID,
    );
  });
});

describe("routePayQrPoint", () => {
  it("treats pizza_sku as a standing offer even if destination_ref is a completed checkout", () => {
    const route = routePayQrPoint({
      name: "Thursday NFC",
      slug: "margherita-nfc",
      orgId: "org-pizzeria",
      isOnline: true,
      destinationType: "pizza_sku",
      destinationRef: COMPLETED_CHECKOUT_ID,
    });
    assert.deepEqual(route, {
      kind: "pizza_sku",
      name: "Thursday NFC",
      slug: "margherita-nfc",
    });
  });

  it("does not fall through to live checkout resolution for pizza_sku", () => {
    const route = routePayQrPoint({
      name: "Thursday NFC",
      slug: "margherita-nfc",
      orgId: "org-pizzeria",
      isOnline: true,
      destinationType: "pizza_sku",
      destinationRef: null,
    });
    assert.equal(route.kind, "pizza_sku");
    assert.notEqual(route.kind, "needs_live_checkout");
  });
});
