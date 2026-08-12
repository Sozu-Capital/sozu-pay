import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { posPaneState } from "./pos-pane.js";

describe("posPaneState", () => {
  it("is empty when there is no amount and no charge", () => {
    assert.equal(posPaneState({ amountUsd: "", hasResult: false }), "empty");
    assert.equal(posPaneState({ amountUsd: "   ", hasResult: false }), "empty");
  });

  it("is preview while an amount is entered and no charge exists", () => {
    assert.equal(posPaneState({ amountUsd: "4.50", hasResult: false }), "preview");
  });

  it("is ready when a charge exists, even if amount is still in the form", () => {
    assert.equal(posPaneState({ amountUsd: "4.50", hasResult: true }), "ready");
  });
});
