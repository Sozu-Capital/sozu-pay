import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";
import { Keypair } from "@stellar/stellar-sdk";
import type { Organization } from "@/lib/db/organizations";
import {
  getEnvSecretAlignedTo,
  resolveHomeTreasurySigner,
  usesPollarHomeTreasury,
} from "./home-treasury-signer.js";

function org(partial: Partial<Organization> & { id: string }): Organization {
  return {
    id: partial.id,
    name: partial.name ?? "Test Org",
    type: partial.type ?? "ngo",
    stellar_disbursement_public_key: partial.stellar_disbursement_public_key ?? null,
    stellar_disbursement_secret_encrypted: partial.stellar_disbursement_secret_encrypted ?? null,
    recovery_encrypted_secret: partial.recovery_encrypted_secret ?? null,
    soroban_contract_id: partial.soroban_contract_id ?? null,
    treasury_contract_id: partial.treasury_contract_id ?? null,
    treasury_guardian_threshold: partial.treasury_guardian_threshold ?? null,
    treasury_manager_user_id: partial.treasury_manager_user_id ?? null,
    referral_code: partial.referral_code ?? null,
    sozu_tag_auth_user_id: partial.sozu_tag_auth_user_id ?? null,
    treasury_smart_account_address: partial.treasury_smart_account_address ?? null,
    created_at: partial.created_at ?? new Date().toISOString(),
    updated_at: partial.updated_at ?? new Date().toISOString(),
  };
}

describe("usesPollarHomeTreasury", () => {
  it("is true for pollar user with Home G", () => {
    assert.equal(
      usesPollarHomeTreasury(
        { privy_user_id: "pollar:abc" },
        org({ id: "1", stellar_disbursement_public_key: Keypair.random().publicKey() }),
      ),
      true,
    );
  });

  it("is false without Pollar mapping", () => {
    assert.equal(
      usesPollarHomeTreasury(
        { privy_user_id: "did:privy:x" },
        org({ id: "1", stellar_disbursement_public_key: Keypair.random().publicKey() }),
      ),
      false,
    );
  });
});

describe("getEnvSecretAlignedTo", () => {
  const kp = Keypair.random();
  let prev: string | undefined;

  beforeEach(() => {
    prev = process.env.ORG_DISBURSEMENT_SECRET;
    process.env.ORG_DISBURSEMENT_SECRET = kp.secret();
  });
  afterEach(() => {
    if (prev === undefined) delete process.env.ORG_DISBURSEMENT_SECRET;
    else process.env.ORG_DISBURSEMENT_SECRET = prev;
  });

  it("returns secret when public keys match", () => {
    assert.equal(getEnvSecretAlignedTo(kp.publicKey()), kp.secret());
  });

  it("returns undefined when public keys differ", () => {
    assert.equal(getEnvSecretAlignedTo(Keypair.random().publicKey()), undefined);
  });
});

describe("resolveHomeTreasurySigner", () => {
  const home = Keypair.random();
  const hot = Keypair.random();
  let prevOrg: string | undefined;
  let prevFake: string | undefined;
  let prevNode: string | undefined;

  beforeEach(() => {
    prevOrg = process.env.ORG_DISBURSEMENT_SECRET;
    prevFake = process.env.POLLAR_FAKE_AUTH;
    prevNode = process.env.NODE_ENV;
  });
  afterEach(() => {
    if (prevOrg === undefined) delete process.env.ORG_DISBURSEMENT_SECRET;
    else process.env.ORG_DISBURSEMENT_SECRET = prevOrg;
    if (prevFake === undefined) delete process.env.POLLAR_FAKE_AUTH;
    else process.env.POLLAR_FAKE_AUTH = prevFake;
    if (prevNode !== undefined) process.env.NODE_ENV = prevNode;
  });

  it("Pollar: refuses mismatched env hot key and asks for client tx", () => {
    process.env.ORG_DISBURSEMENT_SECRET = hot.secret();
    delete process.env.POLLAR_FAKE_AUTH;
    process.env.NODE_ENV = "production";
    const result = resolveHomeTreasurySigner({
      org: org({ id: "1", stellar_disbursement_public_key: home.publicKey() }),
      pollarHomeTreasury: true,
    });
    assert.equal(result.mode, "pollar_client");
    assert.equal(result.signerSecretKey, undefined);
    assert.equal(result.fromAddress, home.publicKey());
  });

  it("Pollar: uses env secret when it is the Home G", () => {
    process.env.ORG_DISBURSEMENT_SECRET = home.secret();
    const result = resolveHomeTreasurySigner({
      org: org({ id: "1", stellar_disbursement_public_key: home.publicKey() }),
      pollarHomeTreasury: true,
    });
    assert.equal(result.mode, "env_aligned");
    assert.equal(result.signerSecretKey, home.secret());
  });

  it("Pollar: fake auth uses pollar_fake without env secret", () => {
    delete process.env.ORG_DISBURSEMENT_SECRET;
    process.env.POLLAR_FAKE_AUTH = "true";
    const result = resolveHomeTreasurySigner({
      org: org({ id: "1", stellar_disbursement_public_key: home.publicKey() }),
      pollarHomeTreasury: true,
    });
    assert.equal(result.mode, "pollar_fake");
    assert.equal(result.fromAddress, home.publicKey());
  });

  it("legacy: allows env fallback when not Pollar home treasury", () => {
    process.env.ORG_DISBURSEMENT_SECRET = hot.secret();
    const result = resolveHomeTreasurySigner({
      org: org({ id: "1", stellar_disbursement_public_key: null }),
      pollarHomeTreasury: false,
    });
    assert.equal(result.mode, "legacy_env");
    assert.equal(result.signerSecretKey, undefined);
  });
});
