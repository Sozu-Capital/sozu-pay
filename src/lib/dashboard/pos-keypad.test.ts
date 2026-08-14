import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyPosKeypadKey, formatPosKeypadDisplay } from "./pos-keypad.js";

describe("applyPosKeypadKey", () => {
  it("appends digits from empty", () => {
    assert.equal(applyPosKeypadKey("", "2"), "2");
    assert.equal(applyPosKeypadKey("2", "4"), "24");
  });

  it("replaces a lone zero when a non-zero digit is pressed", () => {
    assert.equal(applyPosKeypadKey("0", "5"), "5");
  });

  it("allows a single leading zero", () => {
    assert.equal(applyPosKeypadKey("", "0"), "0");
    assert.equal(applyPosKeypadKey("0", "0"), "0");
  });

  it("inserts at most one decimal point", () => {
    assert.equal(applyPosKeypadKey("", "."), "0.");
    assert.equal(applyPosKeypadKey("24", "."), "24.");
    assert.equal(applyPosKeypadKey("24.", "."), "24.");
    assert.equal(applyPosKeypadKey("24.5", "."), "24.5");
  });

  it("caps fraction digits at two", () => {
    assert.equal(applyPosKeypadKey("24.", "5"), "24.5");
    assert.equal(applyPosKeypadKey("24.5", "0"), "24.50");
    assert.equal(applyPosKeypadKey("24.50", "9"), "24.50");
  });

  it("backspaces one character", () => {
    assert.equal(applyPosKeypadKey("24.50", "backspace"), "24.5");
    assert.equal(applyPosKeypadKey("2", "backspace"), "");
    assert.equal(applyPosKeypadKey("", "backspace"), "");
  });

  it("builds 24.50 like the Figma keypad path", () => {
    let amount = "";
    for (const key of ["2", "4", ".", "5", "0"] as const) {
      amount = applyPosKeypadKey(amount, key);
    }
    assert.equal(amount, "24.50");
  });
});

describe("formatPosKeypadDisplay", () => {
  it("shows 0 when empty and otherwise the raw entry", () => {
    assert.equal(formatPosKeypadDisplay(""), "0");
    assert.equal(formatPosKeypadDisplay("  "), "0");
    assert.equal(formatPosKeypadDisplay("24.50"), "24.50");
    assert.equal(formatPosKeypadDisplay("0."), "0.");
  });
});
