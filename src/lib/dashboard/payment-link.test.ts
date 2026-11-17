import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isReusableCharge,
  normalizeUsdAmount,
  checkoutOriginFromHeaders,
  isStubRampCheckoutUrl,
  originOfRedirect,
  parseStandingLink,
  parseStandingPriceUsd,
  payerCheckoutUrl,
  resolveCollectibleReceipt,
  paymentLinkPath,
  slugFromTitle,
  standingPriceRef,
  STANDING_LINK_COLLECTIBLE_FX_SOURCE,
  STANDING_LINK_FX_SOURCE,
} from "./payment-link.js";

describe("slugFromTitle", () => {
  it("builds a slug from the title and drops accents", () => {
    assert.equal(slugFromTitle("Café Latte"), "cafe-latte");
    assert.equal(slugFromTitle("  Front Counter  "), "front-counter");
  });

  it("falls back when the title has no letters", () => {
    assert.equal(slugFromTitle("!!!"), "link");
  });
});

describe("paymentLinkPath", () => {
  it("puts the store ahead of the item so the link is not global", () => {
    assert.equal(
      paymentLinkPath("liquid-society", "liquid-society-tee"),
      "/pay/qr/liquid-society/liquid-society-tee",
    );
    assert.equal(paymentLinkPath("not a store", "tee"), null);
    assert.equal(paymentLinkPath("liquid-society", "../tee"), null);
  });
});

describe("standing price", () => {
  it("normalizes a USD amount and round-trips it on the link", () => {
    assert.equal(normalizeUsdAmount("12,5"), "12.50");
    assert.equal(normalizeUsdAmount("0"), null);
    assert.equal(normalizeUsdAmount("-3"), null);
    const ref = standingPriceRef("12.50");
    assert.equal(parseStandingPriceUsd(ref), "12.50");
    assert.equal(parseStandingPriceUsd("cs_live"), null);
    assert.equal(parseStandingPriceUsd("price:15.00|collectible"), "15.00");
  });

  it("lets a product opt into a collectible receipt and keeps drinks simple", () => {
    assert.equal(resolveCollectibleReceipt("drink", true), false);
    assert.equal(resolveCollectibleReceipt("product", false), false);
    assert.equal(resolveCollectibleReceipt("product", true), true);
    assert.deepEqual(parseStandingLink(standingPriceRef("15.00", { collectibleReceipt: true })), {
      amountUsd: "15.00",
      productKind: "product",
      collectibleReceipt: true,
      editionSize: null,
    });
    assert.deepEqual(
      parseStandingLink(
        standingPriceRef("15.00", { collectibleReceipt: true, editionSize: 10 }),
      ),
      {
        amountUsd: "15.00",
        productKind: "product",
        collectibleReceipt: true,
        editionSize: 10,
      },
    );
    assert.equal(
      standingPriceRef("15.00", { collectibleReceipt: true, editionSize: 10 }),
      "price:15.00|collectible|edition:10",
    );
    assert.deepEqual(
      parseStandingLink(standingPriceRef("4.50", { productKind: "drink", collectibleReceipt: true })),
      {
        amountUsd: "4.50",
        productKind: "drink",
        collectibleReceipt: false,
        editionSize: null,
      },
    );
    assert.equal(
      parseStandingLink("price:4.50|drink|collectible|edition:10")?.editionSize,
      null,
    );
  });
});

describe("checkout host", () => {
  it("keeps a staging payment on the host that opened the link", () => {
    assert.equal(
      checkoutOriginFromHeaders("dev.pay.sozu.capital", "https", "https://pay.sozu.capital"),
      "https://dev.pay.sozu.capital",
    );
    assert.equal(
      originOfRedirect(
        "https://dev.pay.sozu.capital/checkout/cs_1/success",
        "https://pay.sozu.capital",
      ),
      "https://dev.pay.sozu.capital",
    );
  });
});

describe("payer checkout", () => {
  it("sends a staging payment link to the staging wallet, not the ramp stub or the waitlisted app", () => {
    assert.equal(
      payerCheckoutUrl("cs_1", "dev.pay.sozu.capital", "https://app.sozu.capital"),
      "https://dev.sozu.capital/checkout/cs_1",
    );
    assert.equal(
      payerCheckoutUrl("cs_1", "pay.sozu.capital"),
      "https://app.sozu.capital/checkout/cs_1",
    );
    assert.equal(
      isStubRampCheckoutUrl("https://dev.pay.sozu.capital/ramp/stub-checkout?ref=cs_1"),
      true,
    );
    assert.equal(isStubRampCheckoutUrl("https://dev.sozu.capital/checkout/cs_1"), false);
  });
});

describe("isReusableCharge", () => {
  it("keeps standing links and open-amount sends out of the one-sale expiry", () => {
    assert.equal(isReusableCharge(STANDING_LINK_FX_SOURCE), true);
    assert.equal(isReusableCharge(STANDING_LINK_COLLECTIBLE_FX_SOURCE), true);
    assert.equal(isReusableCharge("OPEN_AMOUNT"), true);
    assert.equal(isReusableCharge("POS_CLP_PER_USDC"), false);
    assert.equal(isReusableCharge(null), false);
  });
});
