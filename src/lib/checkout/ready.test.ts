import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CHECKOUT_SETUP_WALLET_PATH,
  isCheckoutSettleReady,
  isCheckoutWalletNotReadyHttpStatus,
} from "./ready.js";
import type { Organization } from "../db/organizations.js";

function org(overrides: Partial<Organization> = {}): Organization {
  return {
    id: "org-1",
    name: "Test Store",
    type: "store",
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

describe("isCheckoutSettleReady", () => {
  it("is false when org is missing or has no settle-to address", () => {
    assert.equal(isCheckoutSettleReady(null), false);
    assert.equal(isCheckoutSettleReady(org()), false);
  });

  it("is true when merchant settle-to resolves", () => {
    assert.equal(
      isCheckoutSettleReady(
        org({
          treasury_smart_account_address:
            "CXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
        }),
      ),
      true,
    );
  });
});

describe("isCheckoutWalletNotReadyHttpStatus", () => {
  it("treats checkout 422 as finish-setup, not other errors", () => {
    assert.equal(isCheckoutWalletNotReadyHttpStatus(422), true);
    assert.equal(isCheckoutWalletNotReadyHttpStatus(400), false);
    assert.equal(isCheckoutWalletNotReadyHttpStatus(502), false);
  });
});

describe("CHECKOUT_SETUP_WALLET_PATH", () => {
  it("points at smart wallet onboarding, not trustline-status", () => {
    assert.equal(CHECKOUT_SETUP_WALLET_PATH, "/onboarding/setup-smart-wallet");
  });
});
