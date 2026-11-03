import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { hasSecretMaterial, secretPersistenceAllowed } from "./mainnet-secrets";

describe("mainnet secret persistence", () => {
  it("is refused on mainnet and allowed on testnet", () => {
    assert.equal(secretPersistenceAllowed("public"), false);
    assert.equal(secretPersistenceAllowed("testnet"), true);
    assert.equal(secretPersistenceAllowed(undefined), true);
  });

  it("treats empty values as no secret material", () => {
    assert.equal(hasSecretMaterial(null, undefined, "", "  "), false);
    assert.equal(hasSecretMaterial(null, "v1:abc"), true);
  });

  it("guards every organizations write that can store a secret", () => {
    const source = readFileSync(path.resolve(import.meta.dirname, "../db/organizations.ts"), "utf8");
    for (const fn of ["createOrganization", "updateOrganizationWallet", "updateOrganizationRecoverySecret"]) {
      const start = source.indexOf(`export async function ${fn}(`);
      assert.ok(start >= 0, `${fn} exists`);
      const body = source.slice(start, source.indexOf("\nexport ", start + 1));
      assert.match(body, /secretPersistenceAllowed\(\)/, `${fn} checks secretPersistenceAllowed()`);
    }
  });
});
