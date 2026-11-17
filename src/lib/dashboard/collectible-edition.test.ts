import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  editionClaimFields,
  editionClaimKey,
  editionCollectibleName,
  editionHoldIsActive,
  nextEditionNumber,
  normalizeEditionSize,
  parseEditionClaim,
} from "./collectible-edition.js";

describe("numbered collectible edition", () => {
  it("accepts a run of 10 and refuses a blank or partial size", () => {
    assert.equal(normalizeEditionSize(10), 10);
    assert.equal(normalizeEditionSize("10"), 10);
    assert.equal(normalizeEditionSize(""), null);
    assert.equal(normalizeEditionSize("10.5"), null);
    assert.equal(normalizeEditionSize(0), null);
  });

  it("gives the next sale the lowest free shirt number", () => {
    assert.equal(nextEditionNumber(10, []), 1);
    assert.equal(nextEditionNumber(10, [1, 2, 3, 4, 5]), 6);
    assert.equal(nextEditionNumber(10, [1, 2, 4]), 3);
    assert.equal(nextEditionNumber(10, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]), null);
  });

  it("round-trips the claim that ties a sale to one shirt", () => {
    const key = editionClaimKey("liquid-society", 6, 10);
    assert.equal(key, "edition:liquid-society:6/10");
    assert.deepEqual(parseEditionClaim(key), { slug: "liquid-society", number: 6, size: 10 });
    assert.deepEqual(editionClaimFields(key), { editionNumber: 6, editionSize: 10 });
    assert.equal(editionCollectibleName("Liquid Society Tee", 6, 10), "Liquid Society Tee 6/10");
  });

  it("keeps a paid shirt and frees one whose checkout expired", () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    const past = new Date(Date.now() - 60_000).toISOString();
    assert.equal(editionHoldIsActive({ status: "completed", expiresAt: past }), true);
    assert.equal(editionHoldIsActive({ status: "pending", expiresAt: future }), true);
    assert.equal(editionHoldIsActive({ status: "pending", expiresAt: past }), false);
    assert.equal(editionHoldIsActive({ status: "failed", expiresAt: future }), false);
  });
});
