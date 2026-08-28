import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canCreateOwnedOrg } from "./can-create-owned-org.js";

describe("canCreateOwnedOrg", () => {
  it("allows create only when the user has no accessible orgs", () => {
    assert.equal(canCreateOwnedOrg(0), true);
    assert.equal(canCreateOwnedOrg(1), false);
    assert.equal(canCreateOwnedOrg(2), false);
  });
});
