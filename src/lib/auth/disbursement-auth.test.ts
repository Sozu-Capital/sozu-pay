import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canManageDisbursements } from "./disbursement-auth.js";
import type { Organization } from "@/lib/db/organizations";
import type { User } from "@/lib/db/users";

function org(overrides: Partial<Organization> = {}): Organization {
  return {
    id: "org-1",
    name: "Test",
    type: "store",
    stellar_disbursement_public_key: null,
    stellar_disbursement_secret_encrypted: null,
    recovery_encrypted_secret: null,
    soroban_contract_id: null,
    treasury_contract_id: null,
    treasury_guardian_threshold: null,
    treasury_manager_user_id: 1,
    referral_code: null,
    sozu_tag_auth_user_id: null,
    treasury_smart_account_address: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

function user(overrides: Partial<User> = {}): User {
  return {
    id: 1,
    privy_user_id: "pollar:op",
    email: "op@example.com",
    username: "op",
    org_id: "org-1",
    admin_level: "user",
    allowed: true,
    stellar_public_key: null,
    stellar_payout_public_key: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    activation_requested_at: null,
    ...overrides,
  } as User;
}

describe("canManageDisbursements", () => {
  it("allows an org owner even when users.admin_level is still user", () => {
    assert.equal(canManageDisbursements(user(), org(), "owner"), true);
  });

  it("allows treasury_manager membership", () => {
    assert.equal(
      canManageDisbursements(user({ id: 2, org_id: "org-1" }), org(), "treasury_manager"),
      true,
    );
  });

  it("rejects a plain member who is not the treasury manager", () => {
    assert.equal(
      canManageDisbursements(
        user({ id: 9, admin_level: "user" }),
        org({ treasury_manager_user_id: 1 }),
        "member",
      ),
      false,
    );
  });
});
