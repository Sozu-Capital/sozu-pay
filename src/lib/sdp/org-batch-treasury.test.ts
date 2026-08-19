import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Keypair } from "@stellar/stellar-sdk";
import type { Organization } from "@/lib/db/organizations";
import { FAKE_POLLAR_STAFF_WALLET } from "@/lib/pollar/types";
import {
  collectOrgBatchTreasuryHolders,
  orgHasBatchPaymentTreasury,
} from "./org-batch-treasury";

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

const CONTRACT_A = "C" + "A".repeat(55);
const CONTRACT_B = "C" + "B".repeat(55);

describe("collectOrgBatchTreasuryHolders", () => {
  it("treats a Pollar classic G as a batch treasury", () => {
    const classicG = Keypair.random().publicKey();
    const holders = collectOrgBatchTreasuryHolders(
      org({ stellar_disbursement_public_key: classicG })
    );
    assert.deepEqual(holders.contractIds, []);
    assert.equal(holders.classicG, classicG);
    assert.equal(orgHasBatchPaymentTreasury(org({ stellar_disbursement_public_key: classicG })), true);
  });

  it("does not treat the fake Pollar sentinel as treasury", () => {
    const holders = collectOrgBatchTreasuryHolders(
      org({ stellar_disbursement_public_key: FAKE_POLLAR_STAFF_WALLET })
    );
    assert.equal(holders.classicG, null);
    assert.equal(
      orgHasBatchPaymentTreasury(
        org({ stellar_disbursement_public_key: FAKE_POLLAR_STAFF_WALLET })
      ),
      false
    );
  });

  it("accepts soroban, treasury, and smart-account C ids without duplicating", () => {
    const holders = collectOrgBatchTreasuryHolders(
      org({
        soroban_contract_id: CONTRACT_A,
        treasury_contract_id: CONTRACT_A,
        treasury_smart_account_address: CONTRACT_B,
      })
    );
    assert.equal(holders.contractIds.length, 2);
    assert.ok(holders.contractIds.includes(CONTRACT_A));
    assert.ok(holders.contractIds.includes(CONTRACT_B));
    assert.equal(holders.classicG, null);
    assert.equal(
      orgHasBatchPaymentTreasury(
        org({ treasury_smart_account_address: CONTRACT_B })
      ),
      true
    );
  });

  it("reports no treasury when every address field is empty", () => {
    assert.equal(orgHasBatchPaymentTreasury(org()), false);
  });
});
