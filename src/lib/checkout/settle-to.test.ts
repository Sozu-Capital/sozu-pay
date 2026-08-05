import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveCheckoutSettleToAddress } from "./settle-to.js";
import type { Organization } from "../db/organizations.js";

function org(overrides: Partial<Organization> = {}): Organization {
  return {
    id: "org-1",
    name: "Test NGO",
    type: "ngo",
    stellar_disbursement_public_key: null,
    stellar_disbursement_secret_encrypted: null,
    recovery_encrypted_secret: null,
    soroban_contract_id: null,
    treasury_contract_id: null,
    treasury_guardian_threshold: null,
    treasury_manager_user_id: null,
    referral_code: null,
    sozu_tag_auth_user_id: null,
    treasury_smart_account_address: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

describe("resolveCheckoutSettleToAddress", () => {
  it("NGO Funding link settles to Org treasury classic G", () => {
    const treasury = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";
    const address = resolveCheckoutSettleToAddress(
      org({
        type: "ngo",
        stellar_disbursement_public_key: treasury,
        treasury_smart_account_address:
          "CXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
      }),
    );
    assert.equal(address, treasury);
  });

  it("merchant prefers treasury smart account when present", () => {
    const sa = "CXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX";
    const address = resolveCheckoutSettleToAddress(
      org({
        type: "store",
        stellar_disbursement_public_key:
          "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
        treasury_smart_account_address: sa,
      }),
    );
    assert.equal(address, sa);
  });

  it("returns null when no receive address", () => {
    assert.equal(resolveCheckoutSettleToAddress(org()), null);
  });
});
