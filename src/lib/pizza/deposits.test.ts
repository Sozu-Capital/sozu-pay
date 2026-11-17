import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  foldSubmittedPizzaDeposits,
  pizzaPayerThanks,
  pizzaPayerWalletHomeUrl,
} from "./deposits.js";

describe("foldSubmittedPizzaDeposits", () => {
  it("sums org total and per-point pizza deposits", () => {
    const folded = foldSubmittedPizzaDeposits([
      { qrPointId: "qr4", amount: 1 },
      { qrPointId: "qr4", amount: 1 },
      { qrPointId: "nfc-1", amount: 1 },
    ]);
    assert.equal(folded.orgTotal, 3);
    assert.equal(folded.byQrPointId.qr4, 2);
    assert.equal(folded.byQrPointId["nfc-1"], 1);
  });

  it("ignores empty or non-positive amounts", () => {
    const folded = foldSubmittedPizzaDeposits([
      { qrPointId: "qr4", amount: 0 },
      { qrPointId: "qr4", amount: -1 },
    ]);
    assert.equal(folded.orgTotal, 0);
    assert.deepEqual(folded.byQrPointId, {});
  });
});

describe("pizza payer thanks", () => {
  it("is a personal thank-you, not chip-will-stay-live copy", () => {
    const copy = pizzaPayerThanks("qr4");
    assert.equal(copy.title, "Thank you");
    assert.match(copy.body, /qr4/);
    assert.doesNotMatch(copy.body, /chip/i);
    assert.doesNotMatch(copy.body, /live/i);
  });

  it("sends the guest to the Sozu wallet origin", () => {
    assert.equal(pizzaPayerWalletHomeUrl("https://app.sozu.capital"), "https://app.sozu.capital/");
    assert.equal(pizzaPayerWalletHomeUrl("https://app.sozu.capital/"), "https://app.sozu.capital/");
  });
});
