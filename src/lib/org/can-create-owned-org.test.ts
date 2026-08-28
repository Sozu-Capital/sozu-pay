import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canCreateOwnedOrg } from "./can-create-owned-org.js";

describe("canCreateOwnedOrg", () => {
  it("allows create even when the user already belongs to orgs", () => {
    assert.equal(canCreateOwnedOrg(0), true);
    assert.equal(canCreateOwnedOrg(1), true);
    assert.equal(canCreateOwnedOrg(2), true);
  });
});
