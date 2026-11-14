import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isReusableCharge,
  normalizeUsdAmount,
  parseStandingPriceUsd,
  slugFromTitle,
  standingPriceRef,
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

describe("standing price", () => {
  it("normalizes a USD amount and round-trips it on the link", () => {
    assert.equal(normalizeUsdAmount("12,5"), "12.50");
    assert.equal(normalizeUsdAmount("0"), null);
    assert.equal(normalizeUsdAmount("-3"), null);
    const ref = standingPriceRef("12.50");
    assert.equal(parseStandingPriceUsd(ref), "12.50");
    assert.equal(parseStandingPriceUsd("cs_live"), null);
  });
});

describe("isReusableCharge", () => {
  it("keeps standing links and open-amount sends out of the one-sale expiry", () => {
    assert.equal(isReusableCharge(STANDING_LINK_FX_SOURCE), true);
    assert.equal(isReusableCharge("OPEN_AMOUNT"), true);
    assert.equal(isReusableCharge("POS_CLP_PER_USDC"), false);
    assert.equal(isReusableCharge(null), false);
  });
});
