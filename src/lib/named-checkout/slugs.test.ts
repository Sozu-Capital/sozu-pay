import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  allocateUniqueSlug,
  isPublicSlug,
  isReservedStoreSlug,
  normalizePublicSlug,
  storeSlugAfterTagChange,
  storeSlugFromOrg,
} from "./slugs.js";

describe("public slugs", () => {
  it("accepts Org Sozu tag shape and rejects reserved product routes", () => {
    assert.equal(normalizePublicSlug("$Maria_Cafe"), "maria_cafe");
    assert.equal(isPublicSlug("maria_cafe"), true);
    assert.equal(isPublicSlug("al"), false);
    assert.equal(isPublicSlug("maria-cafe"), false);
    assert.equal(isReservedStoreSlug("dashboard"), true);
    assert.equal(isReservedStoreSlug("checkout"), true);
    assert.equal(isReservedStoreSlug("maria_cafe"), false);
  });
});

describe("storeSlugFromOrg", () => {
  it("prefers a claimable Org Sozu tag over the display name", () => {
    assert.equal(
      storeSlugFromOrg({
        orgSozuTag: "$maria_cafe",
        displayName: "Other Name",
        taken: new Set(),
      }),
      "maria_cafe",
    );
  });

  it("derives a unique slug from the display name when there is no tag", () => {
    assert.equal(
      storeSlugFromOrg({
        orgSozuTag: null,
        displayName: "María Café",
        taken: new Set(),
      }),
      "maria_cafe",
    );
  });

  it("does not hand out a reserved first segment", () => {
    assert.equal(
      storeSlugFromOrg({
        orgSozuTag: "checkout",
        displayName: "Checkout Shop",
        taken: new Set(),
      }),
      "checkout_shop",
    );
  });

  it("suffixes when the preferred slug is taken", () => {
    assert.equal(
      allocateUniqueSlug("maria_cafe", new Set(["maria_cafe"])),
      "maria_cafe_2",
    );
  });
});

describe("storeSlugAfterTagChange", () => {
  it("keeps the previous slug as a redirect source onto the new tag", () => {
    assert.deepEqual(storeSlugAfterTagChange({ previousSlug: "old_shop", newTag: "$maria_cafe" }), {
      current: "maria_cafe",
      redirectFrom: "old_shop",
    });
  });

  it("rejects a tag that would steal a product route", () => {
    assert.deepEqual(storeSlugAfterTagChange({ previousSlug: "old_shop", newTag: "dashboard" }), {
      error: "reserved",
    });
  });
});
