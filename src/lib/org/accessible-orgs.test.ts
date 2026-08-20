import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  collapseOrgIdsSharingTreasury,
  mergeAccessibleOrgIds,
  pickActiveOrgId,
  planPollarLoginDestination,
  remapToCanonicalOrgId,
  staffTreasuryAlreadyBound,
} from "./accessible-orgs.js";

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

describe("pickActiveOrgId", () => {
  it("uses the session org when inviting, not the primary users.org_id", () => {
    // Logged into dabrunopizza while users.org_id is still mujeres2000-agosto.
    assert.equal(
      pickActiveOrgId({
        sessionOrgId: "org-dabruno",
        primaryOrgId: "org-mujeres",
        accessibleOrgIds: ["org-mujeres", "org-dabruno"],
      }),
      "org-dabruno",
    );
  });

  it("does not silently invite to the primary org when session org is not accessible", () => {
    assert.equal(
      pickActiveOrgId({
        sessionOrgId: "org-dabruno",
        primaryOrgId: "org-mujeres",
        accessibleOrgIds: ["org-mujeres"],
      }),
      null,
    );
  });

  it("falls back to primary only when no session org is selected", () => {
    assert.equal(
      pickActiveOrgId({
        sessionOrgId: null,
        primaryOrgId: "org-mujeres",
        accessibleOrgIds: ["org-mujeres", "org-dabruno"],
      }),
      "org-mujeres",
    );
  });
});

describe("collapseOrgIdsSharingTreasury", () => {
  const staffG = "G".padEnd(56, "A");
  const otherG = "G".padEnd(56, "B");

  it("keeps Dabruno and drops a later clone that copied the same Pollar G", () => {
    const ids = collapseOrgIdsSharingTreasury([
      {
        id: "org-mujeres",
        stellar_disbursement_public_key: otherG,
        created_at: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "org-dabruno",
        stellar_disbursement_public_key: staffG,
        sozu_tag_auth_user_id: "tag-dabruno",
        created_at: "2026-06-01T00:00:00.000Z",
      },
      {
        id: "org-minegocio444",
        stellar_disbursement_public_key: staffG,
        created_at: "2026-08-20T00:00:00.000Z",
      },
    ]);
    assert.deepEqual(ids.sort(), ["org-dabruno", "org-mujeres"].sort());
    assert.equal(
      remapToCanonicalOrgId("org-minegocio444", [
        { id: "org-dabruno", stellar_disbursement_public_key: staffG, sozu_tag_auth_user_id: "tag-dabruno" },
        { id: "org-minegocio444", stellar_disbursement_public_key: staffG },
      ]),
      "org-dabruno",
    );
  });

  it("does not collapse orgs that have no classic treasury", () => {
    assert.deepEqual(
      collapseOrgIdsSharingTreasury([
        { id: "a", stellar_disbursement_public_key: null },
        { id: "b", stellar_disbursement_public_key: null },
      ]).sort(),
      ["a", "b"],
    );
  });
});

describe("staffTreasuryAlreadyBound", () => {
  it("blocks creating a second org on a Pollar G that already funds one", () => {
    assert.equal(staffTreasuryAlreadyBound(["org-dabruno"]), true);
    assert.equal(staffTreasuryAlreadyBound([]), false);
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
