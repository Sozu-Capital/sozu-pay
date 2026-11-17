import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { FakePollarTokenVerifier } from "./adapter.js";
import {
  planPollarSessionBridge,
  pollarPrivyUserId,
  resolvePollarPostAuthRedirect,
} from "./session-bridge.js";

describe("pollarPrivyUserId", () => {
  it("prefixes subject", () => {
    assert.equal(pollarPrivyUserId("abc"), "pollar:abc");
  });
  it("is idempotent", () => {
    assert.equal(pollarPrivyUserId("pollar:abc"), "pollar:abc");
  });
});

describe("FakePollarTokenVerifier", () => {
  const verifier = new FakePollarTokenVerifier();

  it("parses fake.<subject>.<email>", async () => {
    const id = await verifier.verify("fake.sub-9.maria_at_example.com");
    assert.equal(id.subject, "sub-9");
    assert.equal(id.email, "maria@example.com");
    assert.equal(id.authProvider, "google");
  });

  it("rejects non-fake tokens", async () => {
    await assert.rejects(() => verifier.verify("real-jwt"), /Invalid fake token/);
  });
});

describe("resolvePollarPostAuthRedirect", () => {
  it("honors returnTo", () => {
    assert.equal(
      resolvePollarPostAuthRedirect({ org_id: "o1" }, "/dashboard/settings"),
      "/dashboard/settings",
    );
  });

  it("sends multi-org users to the picker instead of switching org", () => {
    assert.equal(
      resolvePollarPostAuthRedirect({ org_id: "o1", membershipCount: 2 }),
      "/onboarding/organizations",
    );
  });

  it("sends new users to org onboarding", () => {
    assert.equal(
      resolvePollarPostAuthRedirect({ org_id: null }),
      "/onboarding/create-organization",
    );
  });
});

describe("planPollarSessionBridge", () => {
  it("maps identity for a new user", () => {
    const plan = planPollarSessionBridge(
      { subject: "sub-1", email: "Maria@Example.com" },
      null,
    );
    assert.equal(plan.privyUserId, "pollar:sub-1");
    assert.equal(plan.email, "maria@example.com");
    assert.equal(plan.redirect, "/onboarding/create-organization");
  });

  it("honors an invite returnTo for a new user", () => {
    const plan = planPollarSessionBridge(
      { subject: "sub-2", email: "staff@example.com" },
      null,
      "/join/invite-token",
    );
    assert.equal(plan.redirect, "/join/invite-token");
  });

  it("resumes existing member without re-onboarding", () => {
    const plan = planPollarSessionBridge(
      { subject: "sub-1", email: "maria@example.com" },
      { org_id: "org-uuid" },
    );
    assert.equal(plan.redirect, "/dashboard");
  });
});
