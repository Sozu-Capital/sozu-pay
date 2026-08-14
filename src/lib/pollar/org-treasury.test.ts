import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Keypair } from "@stellar/stellar-sdk";
import {
  CreatorBoundPollarTreasuryProvisioner,
  FakeOrgTreasuryProvisioner,
} from "./org-treasury.js";
import { FAKE_POLLAR_STAFF_WALLET } from "./types.js";

type MiniUser = {
  id: number;
  privy_user_id: string;
  email: string;
  stellar_public_key: string | null;
  stellar_payout_public_key: string | null;
  allowed: boolean;
  admin_level: "user" | "admin" | "super_admin";
  org_id: string | null;
  activation_requested_at: string | null;
  created_at: string;
  updated_at: string;
};

function user(overrides: Partial<MiniUser> = {}): MiniUser {
  return {
    id: 1,
    privy_user_id: "pollar:creator-1",
    email: "creator@example.com",
    stellar_public_key: Keypair.random().publicKey(),
    stellar_payout_public_key: null,
    allowed: true,
    admin_level: "super_admin",
    org_id: null,
    activation_requested_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

describe("Org treasury provisioner (NO-GO fallback)", () => {
  it("binds creator Staff Pollar wallet", async () => {
    const provisioner = new CreatorBoundPollarTreasuryProvisioner();
    const u = user();
    const result = await provisioner.provisionForCreator(u as never);
    assert.equal(result.source, "creator_staff_pollar_wallet");
    assert.equal(result.publicKey, u.stellar_public_key);
  });

  it("rejects non-Pollar creators", async () => {
    const provisioner = new CreatorBoundPollarTreasuryProvisioner();
    await assert.rejects(
      () =>
        provisioner.provisionForCreator(user({ privy_user_id: "passkey:x" }) as never),
      /Pollar-mapped/,
    );
  });

  it("rejects missing creator wallet", async () => {
    const provisioner = new CreatorBoundPollarTreasuryProvisioner();
    await assert.rejects(
      () =>
        provisioner.provisionForCreator(user({ stellar_public_key: null }) as never),
      /wallet address missing/,
    );
  });

  it("rejects fake Pollar sentinel as creator wallet", async () => {
    const provisioner = new CreatorBoundPollarTreasuryProvisioner();
    await assert.rejects(
      () =>
        provisioner.provisionForCreator(
          user({ stellar_public_key: FAKE_POLLAR_STAFF_WALLET }) as never,
        ),
      /stub|local stub|real Stellar/,
    );
  });

  it("fake provisioner returns a G address", async () => {
    const provisioner = new FakeOrgTreasuryProvisioner();
    const result = await provisioner.provisionForCreator(
      user({ stellar_public_key: null }) as never,
    );
    assert.ok(result.publicKey.startsWith("G"));
    assert.equal(result.source, "creator_staff_pollar_wallet");
  });
});
