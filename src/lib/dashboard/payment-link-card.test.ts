import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatPaymentLinkPrice,
  paymentLinkCardFilename,
  paymentLinkCardRegions,
  paymentLinkShareText,
  paymentLinkStoreLabel,
  PAYMENT_LINK_CARD,
  wrapText,
} from "./payment-link-card.js";

const charWidth = (sample: string) => sample.length * 10;

describe("payment link share card", () => {
  it("names the png from the item title", () => {
    assert.equal(paymentLinkCardFilename("House Latte"), "house-latte-qr.png");
    assert.equal(paymentLinkCardFilename("Café"), "cafe-qr.png");
  });

  it("prints the store name, then the slug, then Sozu", () => {
    assert.equal(paymentLinkStoreLabel("  North Café  ", "north-cafe"), "North Café");
    assert.equal(paymentLinkStoreLabel("  ", "north-cafe"), "north-cafe");
    assert.equal(paymentLinkStoreLabel(null, ""), "Sozu");
  });

  it("formats a fixed USD price", () => {
    assert.equal(formatPaymentLinkPrice("4.50"), "$4.50 USD");
    assert.equal(formatPaymentLinkPrice(null), null);
  });

  it("includes the item, store, price, and URL in the share text", () => {
    assert.equal(
      paymentLinkShareText({
        item: "House latte",
        store: "North Café",
        price: "$4.50 USD",
        url: "https://pay.sozu.capital/pay/qr/north-cafe/house-latte",
      }),
      "House latte\nNorth Café\n$4.50 USD\nhttps://pay.sozu.capital/pay/qr/north-cafe/house-latte",
    );
  });

  it("places the QR above the item, store, and price", () => {
    const region = paymentLinkCardRegions();
    assert.ok(region.qrY > region.cardY);
    assert.ok(region.textTop >= region.qrY + region.qrSize);
    assert.ok(region.textTop < region.textBottom);
    assert.equal(region.qrX, region.cardX + (region.cardW - PAYMENT_LINK_CARD.qrSize) / 2);
    assert.ok(region.cardX > 0);
    assert.ok(region.cardY > 0);
    assert.ok(region.textWidth > 200);
  });

  it("wraps long copy and ellipsizes the last line", () => {
    assert.deepEqual(wrapText("House latte", 200, charWidth, 2), ["House latte"]);
    assert.deepEqual(wrapText("House latte with oat milk", 110, charWidth, 2), [
      "House",
      "latte with…",
    ]);
    const url = "https://pay.sozu.capital/pay/qr/north-cafe/house-latte";
    const lines = wrapText(url, 200, charWidth, 2);
    assert.equal(lines.length, 2);
    assert.ok(lines[1]?.endsWith("…"));
  });
});
