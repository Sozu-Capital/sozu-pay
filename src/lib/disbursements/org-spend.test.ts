import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import {
  confirmOrgTreasurySpend,
  approveQueuedOrgSpend,
} from "@/lib/disbursements/org-spend";
import { resetSpendRequestsForTests, listPendingSpendRequests } from "@/lib/disbursements/spend-requests";
import { FakeOrgSpendExecutor } from "@/lib/pollar/spend";
import { FAKE_POLLAR_STAFF_WALLET } from "@/lib/pollar/types";
import type { Organization } from "@/lib/db/organizations";
import type { User } from "@/lib/db/users";

function org(overrides: Partial<Organization> = {}): Organization {
  return {
    id: "org-1",
    name: "Test NGO",
    type: "ngo",
    stellar_disbursement_public_key: FAKE_POLLAR_STAFF_WALLET,
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
    privy_user_id: "pollar:creator",
    email: "owner@example.com",
    username: "owner",
    org_id: "org-1",
    admin_level: "super_admin",
    allowed: true,
    stellar_public_key: FAKE_POLLAR_STAFF_WALLET,
    stellar_payout_public_key: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    activation_requested_at: null,
    ...overrides,
  } as User;
}

const payments = [
  {
    paymentId: "p1",
    toAddress: "GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB",
    amount: "25",
    recipientLabel: "Recipient",
  },
];

describe("confirmOrgTreasurySpend (NO-GO fallback)", () => {
  beforeEach(() => {
    resetSpendRequestsForTests();
  });

  it("owner + fake executor executes and audits acting user", async () => {
    const executor = new FakeOrgSpendExecutor();
    const result = await confirmOrgTreasurySpend({
      org: org(),
      user: user(),
      disbursementId: "d-1",
      payments,
      executor,
    });
    assert.equal(result.outcome, "executed");
    if (result.outcome !== "executed") return;
    assert.equal(result.txHashes.length, 1);
    assert.equal(executor.calls[0]?.actingUserId, "1");
    assert.equal(executor.calls[0]?.fromAddress, FAKE_POLLAR_STAFF_WALLET);
  });

  it("non-owner queues for approval without moving funds", async () => {
    const executor = new FakeOrgSpendExecutor();
    const result = await confirmOrgTreasurySpend({
      org: org(),
      user: user({ id: 2, email: "staff@example.com", admin_level: "admin", privy_user_id: "pollar:staff" }),
      disbursementId: "d-2",
      payments,
      executor,
    });
    assert.equal(result.outcome, "queued");
    assert.equal(executor.calls.length, 0);
    assert.equal(listPendingSpendRequests("org-1").length, 1);
  });

  it("owner can approve queued spend", async () => {
    const executor = new FakeOrgSpendExecutor();
    const queued = await confirmOrgTreasurySpend({
      org: org(),
      user: user({ id: 2, email: "staff@example.com", admin_level: "admin" }),
      disbursementId: "d-3",
      payments,
      executor,
    });
    assert.equal(queued.outcome, "queued");
    if (queued.outcome !== "queued") return;

    const approved = await approveQueuedOrgSpend({
      org: org(),
      user: user(),
      spendRequest: queued.spendRequest,
      executor,
    });
    assert.equal(approved.spendRequest.status, "executed");
    assert.equal(approved.txHashes.length, 1);
    assert.equal(listPendingSpendRequests("org-1").length, 0);
  });

  it("non-owner cannot approve", async () => {
    const executor = new FakeOrgSpendExecutor();
    const queued = await confirmOrgTreasurySpend({
      org: org(),
      user: user({ id: 2, admin_level: "admin" }),
      disbursementId: "d-4",
      payments,
      executor,
    });
    if (queued.outcome !== "queued") return;
    await assert.rejects(
      () =>
        approveQueuedOrgSpend({
          org: org(),
          user: user({ id: 2, admin_level: "admin" }),
          spendRequest: queued.spendRequest,
          executor,
        }),
      /treasury owner/,
    );
  });
});
