import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  checkoutProductImageUrl,
  matchingQrPointForCheckout,
  productImagePath,
  productImageUrl,
} from "./checkout-product-image.js";

const TEE = {
  slug: "defi-your-mind-tee",
  name: "DeFi Your Mind Tee",
  imageUrl: "data:image/jpeg;base64,/9j/aaaa",
  destinationRef: "price:15.00|collectible|edition:10",
};

const LATTE = {
  slug: "house-latte",
  name: "House Latte",
  imageUrl: null,
  destinationRef: "price:4.50|drink",
};

describe("checkout product image", () => {
  it("builds the public photo URL for a payment link", () => {
    assert.equal(
      productImagePath("org-1", "defi-your-mind-tee"),
      "/api/public/stores/org-1/items/defi-your-mind-tee/image",
    );
    assert.equal(
      productImageUrl("https://pay.sozu.capital/", "org-1", "defi-your-mind-tee"),
      "https://pay.sozu.capital/api/public/stores/org-1/items/defi-your-mind-tee/image",
    );
  });

  it("finds a numbered shirt from the edition claim, not the 6/10 receipt name", () => {
    const point = matchingQrPointForCheckout(
      {
        reference: "DeFi Your Mind Tee 6/10",
        idempotency_key: "edition:defi-your-mind-tee:6/10",
      },
      [LATTE, TEE],
    );
    assert.equal(point?.slug, "defi-your-mind-tee");
    assert.equal(
      checkoutProductImageUrl("https://pay.sozu.capital", "org-1", {
        reference: "DeFi Your Mind Tee 6/10",
        idempotency_key: "edition:defi-your-mind-tee:6/10",
      }, [TEE]),
      "https://pay.sozu.capital/api/public/stores/org-1/items/defi-your-mind-tee/image",
    );
  });

  it("finds a standing link by the item name when there is no edition claim", () => {
    const point = matchingQrPointForCheckout(
      { reference: "DeFi Your Mind Tee", idempotency_key: null },
      [LATTE, TEE],
    );
    assert.equal(point?.slug, "defi-your-mind-tee");
  });

  it("returns no photo when the payment link has none", () => {
    assert.equal(
      checkoutProductImageUrl("https://pay.sozu.capital", "org-1", {
        reference: "House Latte",
        idempotency_key: null,
      }, [LATTE]),
      null,
    );
  });
});
