import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildPosReceiptFields, formatPosReceiptTime } from "./pos-receipt.js";

describe("formatPosReceiptTime", () => {
  it("formats a valid ISO time and falls back for missing", () => {
    assert.notEqual(formatPosReceiptTime("2026-08-14T12:30:00.000Z", "en-US"), "—");
    assert.equal(formatPosReceiptTime(null), "—");
    assert.equal(formatPosReceiptTime("nope"), "—");
  });
});

describe("buildPosReceiptFields", () => {
  it("includes CLP amount, time, and payment reference fields", () => {
    const fields = buildPosReceiptFields({
      amountClp: "12500",
      formatAmount: (raw) => `fmt:${raw}`,
      currencyLabel: "CLP",
      paidAtIso: "2026-08-14T12:30:00.000Z",
      paymentId: "cs_abc",
      reference: "mesa-4",
      locale: "en-US",
    });
    assert.equal(fields.amountClpDisplay, "fmt:12500");
    assert.equal(fields.currencyLabel, "CLP");
    assert.equal(fields.paymentId, "cs_abc");
    assert.equal(fields.reference, "mesa-4");
    assert.notEqual(fields.paidAtLabel, "—");
  });
});
