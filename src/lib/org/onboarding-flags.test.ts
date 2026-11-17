import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { matchingOwnedOrg, orgOnboardingFlags, primaryOrgIdAfterCreate } from "./onboarding-flags.js";

describe("orgOnboardingFlags", () => {
  it("does not send a Pollar user back to create-org after they already have a primary org", () => {
    const flags = orgOnboardingFlags({
      canonicalOrgId: null,
      primaryOrgId: "org-new",
      isPollarUser: true,
      hasMemberSmartAccount: false,
    });
    assert.equal(flags.needsOrgCreation, false);
    assert.equal(flags.needsOrganization, true);
    assert.equal(flags.needsSmartWalletSetup, false);
  });

  it("never asks Pollar users to set up a passkey smart wallet", () => {
    const flags = orgOnboardingFlags({
      canonicalOrgId: "org-new",
      primaryOrgId: "org-new",
      isPollarUser: true,
      hasMemberSmartAccount: false,
    });
    assert.equal(flags.needsSmartWalletSetup, false);
    assert.equal(flags.needsOrgCreation, false);
    assert.equal(flags.needsOrganization, false);
  });

  it("still sends a new user with no org to create-organization", () => {
    const flags = orgOnboardingFlags({
      canonicalOrgId: null,
      primaryOrgId: null,
      isPollarUser: true,
      hasMemberSmartAccount: false,
    });
    assert.equal(flags.needsOrgCreation, true);
    assert.equal(flags.needsOrganization, true);
  });

  it("still requires a passkey smart wallet for non-Pollar orgs", () => {
    const flags = orgOnboardingFlags({
      canonicalOrgId: "org-a",
      primaryOrgId: "org-a",
      isPollarUser: false,
      hasMemberSmartAccount: false,
    });
    assert.equal(flags.needsSmartWalletSetup, true);
  });
});

describe("matchingOwnedOrg", () => {
  it("finds an org the user already created with the same name", () => {
    const match = matchingOwnedOrg(
      [
        { id: "a", name: "Cafe Sozu" },
        { id: "b", name: "Dabruno" },
      ],
      "  cafe sozu ",
    );
    assert.equal(match?.id, "a");
  });
});

describe("primaryOrgIdAfterCreate", () => {
  it("points primary at the org just created so a unique-G second org survives logout", () => {
    assert.equal(primaryOrgIdAfterCreate("org-old", "org-new"), "org-new");
    assert.equal(primaryOrgIdAfterCreate(null, "org-new"), "org-new");
  });
});
