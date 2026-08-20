import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  parsePayoutAsset,
  parsePizzaSendAmount,
  pizzaSendAmountI128,
} from "./asset.js";

describe("parsePayoutAsset", () => {
  it("defaults blank to USDC", () => {
    assert.equal(parsePayoutAsset(undefined), "USDC");
    assert.equal(parsePayoutAsset(""), "USDC");
    assert.equal(parsePayoutAsset("usdc"), "USDC");
  });

  it("accepts PIZZA", () => {
    assert.equal(parsePayoutAsset("PIZZA"), "PIZZA");
    assert.equal(parsePayoutAsset("pizza"), "PIZZA");
  });

  it("rejects unknown assets", () => {
    assert.throws(() => parsePayoutAsset("XLM"), /Unsupported payout asset/);
  });
});

describe("parsePizzaSendAmount", () => {
  it("accepts whole pizzas of at least 1", () => {
    assert.equal(parsePizzaSendAmount("1"), 1);
    assert.equal(parsePizzaSendAmount("20"), 20);
  });

  it("rejects fractions, zero, and decimals (0-decimal token)", () => {
    assert.throws(() => parsePizzaSendAmount("0"), /whole number/);
    assert.throws(() => parsePizzaSendAmount("1.5"), /whole number/);
    assert.throws(() => parsePizzaSendAmount("1.0"), /whole number/);
    assert.throws(() => parsePizzaSendAmount("-1"), /whole number/);
  });
});

describe("pizzaSendAmountI128", () => {
  it("encodes 3 PIZZA as i128 3, not 10^7 stroops", () => {
    assert.equal(pizzaSendAmountI128("3"), "3");
    assert.notEqual(pizzaSendAmountI128("3"), "30000000");
  });
});
