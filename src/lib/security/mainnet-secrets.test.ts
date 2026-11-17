import assert from "node:assert/strict";
import { afterEach, before, beforeEach, describe, it } from "node:test";
import { hasSecretMaterial, MAINNET_SECRET_PERSISTENCE_ERROR, secretPersistenceAllowed } from "./mainnet-secrets";

process.env.NEXT_PUBLIC_SUPABASE_URL = "http://supabase.test";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role";

type Sent = { method: string; url: string; body: string };
const sent: Sent[] = [];
const realFetch = globalThis.fetch;
const originalNetwork = process.env.STELLAR_NETWORK;

const orgRow = { id: "org-1", name: "Org", type: "ngo" };

globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  sent.push({ method: init?.method ?? "GET", url, body: typeof init?.body === "string" ? init.body : "" });
  return new Response(JSON.stringify(orgRow), { status: 200, headers: { "content-type": "application/json" } });
}) as typeof fetch;

let orgs: typeof import("../db/organizations");

const SECRET = "v1:encrypted-secret";

describe("mainnet secret persistence", () => {
  before(async () => {
    orgs = await import("../db/organizations");
  });
  beforeEach(() => {
    sent.length = 0;
  });
  afterEach(() => {
    if (originalNetwork === undefined) delete process.env.STELLAR_NETWORK;
    else process.env.STELLAR_NETWORK = originalNetwork;
  });

  it("is refused on mainnet and allowed on testnet", () => {
    assert.equal(secretPersistenceAllowed("public"), false);
    assert.equal(secretPersistenceAllowed("testnet"), true);
    assert.equal(secretPersistenceAllowed(undefined), true);
  });

  it("treats empty values as no secret material", () => {
    assert.equal(hasSecretMaterial(null, undefined, "", "  "), false);
    assert.equal(hasSecretMaterial(null, "v1:abc"), true);
  });

  describe("on mainnet", () => {
    beforeEach(() => {
      process.env.STELLAR_NETWORK = "public";
    });

    it("createOrganization refuses a secret before writing", async () => {
      await assert.rejects(
        orgs.createOrganization({ name: "Org", type: "ngo", stellar_disbursement_secret_encrypted: SECRET }),
        { message: MAINNET_SECRET_PERSISTENCE_ERROR },
      );
      await assert.rejects(orgs.createOrganization({ name: "Org", type: "ngo", recovery_encrypted_secret: SECRET }), {
        message: MAINNET_SECRET_PERSISTENCE_ERROR,
      });
      assert.deepEqual(sent, []);
    });

    it("updateOrganizationWallet refuses a secret before writing", async () => {
      assert.equal(await orgs.updateOrganizationWallet("org-1", "GPUBLIC", SECRET), null);
      assert.deepEqual(sent, []);
    });

    it("updateOrganizationRecoverySecret refuses a secret before writing", async () => {
      assert.equal(await orgs.updateOrganizationRecoverySecret("org-1", SECRET), null);
      assert.deepEqual(sent, []);
    });

    it("still allows clearing the recovery secret", async () => {
      assert.ok(await orgs.updateOrganizationRecoverySecret("org-1", null));
      assert.equal(sent.length, 1);
      assert.equal(JSON.parse(sent[0].body).recovery_encrypted_secret, null);
    });
  });

  describe("on testnet", () => {
    beforeEach(() => {
      process.env.STELLAR_NETWORK = "testnet";
    });

    it("writes the recovery secret", async () => {
      assert.ok(await orgs.updateOrganizationRecoverySecret("org-1", SECRET));
      assert.equal(JSON.parse(sent[0].body).recovery_encrypted_secret, SECRET);
    });

    it("writes the wallet secret", async () => {
      assert.ok(await orgs.updateOrganizationWallet("org-1", "GPUBLIC", SECRET));
      assert.equal(JSON.parse(sent[0].body).stellar_disbursement_secret_encrypted, SECRET);
    });
  });
});

process.on("exit", () => {
  globalThis.fetch = realFetch;
});
