import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isMissingProductImageColumn,
  parseProductImageDataUrl,
  paymentLinkImageUrl,
  PRODUCT_IMAGE_DATA_URL_MAX_LENGTH,
  readStoredProductImage,
} from "./product-image.js";

const jpeg = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBD";

describe("parseProductImageDataUrl", () => {
  it("accepts a jpeg, png, or webp data URL and clears with null", () => {
    assert.equal(parseProductImageDataUrl(jpeg), jpeg);
    assert.equal(parseProductImageDataUrl("data:image/png;base64,iVBORw0KGgo="), "data:image/png;base64,iVBORw0KGgo=");
    assert.equal(parseProductImageDataUrl("data:image/webp;base64,UklGRg=="), "data:image/webp;base64,UklGRg==");
    assert.equal(parseProductImageDataUrl(null), null);
    assert.equal(parseProductImageDataUrl(""), null);
  });

  it("rejects a file that is not an image data URL", () => {
    assert.throws(() => parseProductImageDataUrl("https://example.com/tee.jpg"), /INVALID_PRODUCT_IMAGE/);
    assert.throws(() => parseProductImageDataUrl("data:image/gif;base64,R0lGOD"), /INVALID_PRODUCT_IMAGE/);
  });

  it("rejects a photo that is too large to store on the link", () => {
    const huge = `data:image/jpeg;base64,${"A".repeat(PRODUCT_IMAGE_DATA_URL_MAX_LENGTH)}`;
    assert.throws(() => parseProductImageDataUrl(huge), /PRODUCT_IMAGE_TOO_LARGE/);
  });
});

describe("readStoredProductImage", () => {
  it("returns only a stored data URL", () => {
    assert.equal(readStoredProductImage(jpeg), jpeg);
    assert.equal(readStoredProductImage("https://example.com/tee.jpg"), null);
    assert.equal(readStoredProductImage(null), null);
  });
});

describe("paymentLinkImageUrl", () => {
  it("points at the public photo for a store item", () => {
    assert.equal(
      paymentLinkImageUrl("https://dev.pay.sozu.capital/", "org-1", "house-latte"),
      "https://dev.pay.sozu.capital/api/public/stores/org-1/items/house-latte/image",
    );
    assert.equal(paymentLinkImageUrl("", "org-1", "latte"), null);
  });
});

describe("isMissingProductImageColumn", () => {
  it("recognizes a database that has not added image_url yet", () => {
    assert.equal(
      isMissingProductImageColumn(
        "Could not find the 'image_url' column of 'merchant_qr_points' in the schema cache",
      ),
      true,
    );
    assert.equal(isMissingProductImageColumn("duplicate key"), false);
  });
});
