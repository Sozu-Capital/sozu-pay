import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readyForNextPaymentState } from "./pos-ready-next.js";

describe("readyForNextPaymentState", () => {
  it("clears payment UI and keypad for the next amount entry", () => {
    const next = readyForNextPaymentState();
    assert.equal(next.amountClp, "");
    assert.equal(next.reference, "");
    assert.equal(next.result, null);
    assert.equal(next.paid, false);
    assert.equal(next.paidAt, null);
    assert.equal(next.error, null);
    assert.equal(next.showReceipt, false);
  });
});
