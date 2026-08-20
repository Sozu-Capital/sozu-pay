import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mergeAccessibleOrgIds, planPollarLoginDestination } from "./accessible-orgs.js";

describe("mergeAccessibleOrgIds", () => {
  it("unions primary, session, memberships, treasury-managed, and Staff-wallet orgs", () => {
    assert.deepEqual(
      mergeAccessibleOrgIds({
        primaryOrgId: "a",
        sessionOrgId: "b",
        memberOrgIds: ["b", "c"],
        managedOrgIds: ["a", "d"],
        staffWalletOrgIds: ["e"],
      }).sort(),
      ["a", "b", "c", "d", "e"],
    );
  });

  it("drops empty values", () => {
    assert.deepEqual(mergeAccessibleOrgIds({ primaryOrgId: null, memberOrgIds: [""] }), []);
  });
});

describe("planPollarLoginDestination", () => {
  it("sends a two-org Pollar user to the picker instead of resuming the last org", () => {
    const plan = planPollarLoginDestination({
      orgIds: ["org-a", "org-b"],
      primaryOrgId: "org-b",
      preservedOrgId: "org-b",
    });
    assert.equal(plan.redirect, "/onboarding/organizations");
    assert.equal(plan.sessionOrgId, null);
  });

  it("resumes the only org", () => {
    const plan = planPollarLoginDestination({
      orgIds: ["org-a"],
      primaryOrgId: "org-a",
      preservedOrgId: "org-a",
    });
    assert.equal(plan.redirect, "/dashboard");
    assert.equal(plan.sessionOrgId, "org-a");
  });

  it("honors invite returnTo without forcing the picker", () => {
    const plan = planPollarLoginDestination({
      orgIds: ["org-a", "org-b"],
      primaryOrgId: "org-a",
      preservedOrgId: "org-a",
      returnTo: "/join/tok",
    });
    assert.equal(plan.redirect, "/join/tok");
    assert.equal(plan.sessionOrgId, "org-a");
  });

  it("sends a new user to create-org", () => {
    const plan = planPollarLoginDestination({
      orgIds: [],
      primaryOrgId: null,
      preservedOrgId: null,
    });
    assert.equal(plan.redirect, "/onboarding/create-organization");
  });
});
