import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { amountClpForRegeneration } from "./pos-regenerate.js";

describe("amountClpForRegeneration", () => {
  it("prefers the keypad amount and falls back to the last charged CLP", () => {
    assert.equal(
      amountClpForRegeneration({ keypadAmountClp: "12500", lastChargedClp: "999" }),
      "12500",
    );
    assert.equal(
      amountClpForRegeneration({ keypadAmountClp: "", lastChargedClp: "12500" }),
      "12500",
    );
    assert.equal(
      amountClpForRegeneration({ keypadAmountClp: "  ", lastChargedClp: null }),
      "",
    );
  });
});
