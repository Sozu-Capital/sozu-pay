import assert from "node:assert/strict";
import { describe, it } from "node:test";

/** Pure reserve math — mirrors wallet-health spendable estimate. */
function spendableXlm(total: number, subentryCount: number, baseReserve = 0.5): number {
  const min = (2 + subentryCount) * baseReserve;
  return Math.max(0, total - min);
}

describe("spendable XLM after reserves", () => {
  it("treats 0 XLM + trustline as 0 spendable (TX_INSUFFICIENT_FEE case)", () => {
    assert.equal(spendableXlm(0, 1), 0);
  });

  it("shows why 1.5 XLM with one trustline looks funded but cannot pay fees", () => {
    assert.equal(spendableXlm(1.5, 1), 0);
  });

  it("leaves headroom once above min balance", () => {
    assert.equal(spendableXlm(3, 1), 1.5);
  });
});
