import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { orgSwitcherInitials } from "./org-switcher.js";

describe("orgSwitcherInitials", () => {
  it("uses two letters from a single word", () => {
    assert.equal(orgSwitcherInitials("Sozu"), "SO");
  });

  it("uses the first letter of the first two words", () => {
    assert.equal(orgSwitcherInitials("Mujeres 2000"), "M2");
  });

  it("returns a placeholder for an empty name", () => {
    assert.equal(orgSwitcherInitials("   "), "?");
  });
});
