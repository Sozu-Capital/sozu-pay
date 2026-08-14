import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  POS_QR_CARD_SIZE_PX,
  POS_QR_CODE_SIZE_PX,
  posPaymentQrValue,
} from "./pos-qr.js";

describe("posPaymentQrValue", () => {
  it("encodes the trimmed live checkout URL only", () => {
    assert.equal(
      posPaymentQrValue("  https://pay.sozu.capital/checkout/cs_abc  "),
      "https://pay.sozu.capital/checkout/cs_abc",
    );
  });
});

describe("POS QR card sizes", () => {
  it("matches Figma ~256px card with inset local SVG (no CDN)", () => {
    assert.equal(POS_QR_CARD_SIZE_PX, 256);
    assert.ok(POS_QR_CODE_SIZE_PX < POS_QR_CARD_SIZE_PX);
  });
});
