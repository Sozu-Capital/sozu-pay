import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  POS_CLP_PER_USDC_FALLBACK,
  buildClpPricingQuote,
  clpToUsdcAmount,
  formatClpDisplay,
  parseWholeClpAmount,
  posCreatePayloadFields,
  resolveClpPerUsdcRate,
} from "./clp-pricing.js";

describe("parseWholeClpAmount", () => {
  it("accepts whole pesos only", () => {
    assert.equal(parseWholeClpAmount("24500"), 24500);
    assert.equal(parseWholeClpAmount("24.50"), null);
    assert.equal(parseWholeClpAmount("0"), null);
    assert.equal(parseWholeClpAmount(""), null);
  });
});

describe("formatClpDisplay", () => {
  it("formats with es-CL grouping and no decimals", () => {
    assert.equal(formatClpDisplay(""), "0");
    assert.equal(formatClpDisplay("24500"), "24.500");
    assert.equal(formatClpDisplay("1000"), "1.000");
  });
});

describe("resolveClpPerUsdcRate", () => {
  it("prefers env, then Frankfurter, then pilot fallback", () => {
    assert.deepEqual(resolveClpPerUsdcRate({ envRate: "900" }), {
      clpPerUsdc: 900,
      fxSource: "POS_CLP_PER_USDC",
    });
    assert.deepEqual(resolveClpPerUsdcRate({ frankfurterClpPerUsd: 980 }), {
      clpPerUsdc: 980,
      fxSource: "Frankfurter USD→CLP",
    });
    assert.deepEqual(resolveClpPerUsdcRate({}), {
      clpPerUsdc: POS_CLP_PER_USDC_FALLBACK,
      fxSource: `pilot fallback ${POS_CLP_PER_USDC_FALLBACK}`,
    });
  });
});

describe("clpToUsdcAmount / buildClpPricingQuote", () => {
  it("converts CLP → USDC with 2 dp and builds API payload fields", () => {
    assert.equal(clpToUsdcAmount(9500, 950), "10.00");
    const quote = buildClpPricingQuote("9500", { envRate: "950" });
    assert.ok(quote);
    assert.deepEqual(posCreatePayloadFields(quote!), {
      amountClp: "9500",
      amountUsd: "10.00",
      pricingCurrency: "CLP",
      clpPerUsdc: 950,
      fxSource: "POS_CLP_PER_USDC",
    });
  });
});
