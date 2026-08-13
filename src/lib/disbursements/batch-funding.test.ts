import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isBatchFunded, pollarBatchAvailableUsdc } from "./batch-funding";

describe("isBatchFunded", () => {
  it("returns true when remaining is 0", () => {
    assert.equal(isBatchFunded({ remaining: 0, availableUsdc: 0 }), true);
    assert.equal(isBatchFunded({ remaining: 0, availableUsdc: 100 }), true);
  });

  it("returns true when remaining is negative", () => {
    assert.equal(isBatchFunded({ remaining: -5, availableUsdc: 0 }), true);
  });

  it("returns true when available covers remaining exactly", () => {
    assert.equal(isBatchFunded({ remaining: 100, availableUsdc: 100 }), true);
  });

  it("returns true when available exceeds remaining", () => {
    assert.equal(isBatchFunded({ remaining: 50, availableUsdc: 100 }), true);
  });

  it("returns false when available is less than remaining", () => {
    assert.equal(isBatchFunded({ remaining: 100, availableUsdc: 50 }), false);
    assert.equal(isBatchFunded({ remaining: 100, availableUsdc: 0 }), false);
  });

  it("handles floating point with epsilon tolerance", () => {
    // Just below threshold without epsilon would fail, but epsilon makes it pass
    assert.equal(isBatchFunded({ remaining: 100, availableUsdc: 99.9999999999 }), true);
  });
});

describe("pollarBatchAvailableUsdc", () => {
  it("returns 0 for null balance", () => {
    assert.equal(pollarBatchAvailableUsdc(null), 0);
  });

  it("returns 0 for undefined usdc", () => {
    assert.equal(pollarBatchAvailableUsdc({}), 0);
  });

  it("returns 0 for empty string usdc", () => {
    assert.equal(pollarBatchAvailableUsdc({ usdc: "" }), 0);
  });

  it("parses valid numeric string", () => {
    assert.equal(pollarBatchAvailableUsdc({ usdc: "100" }), 100);
    assert.equal(pollarBatchAvailableUsdc({ usdc: "0" }), 0);
    assert.equal(pollarBatchAvailableUsdc({ usdc: "123.456" }), 123.456);
  });

  it("returns 0 for invalid numeric string", () => {
    assert.equal(pollarBatchAvailableUsdc({ usdc: "abc" }), 0);
    assert.equal(pollarBatchAvailableUsdc({ usdc: "NaN" }), 0);
  });

  it("returns 0 for negative values", () => {
    assert.equal(pollarBatchAvailableUsdc({ usdc: "-50" }), 0);
  });

  it("returns 0 for Infinity", () => {
    assert.equal(pollarBatchAvailableUsdc({ usdc: "Infinity" }), 0);
  });
});
