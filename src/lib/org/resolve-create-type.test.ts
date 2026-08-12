import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveCreateOrganizationType } from "./resolve-create-type.js";

describe("resolveCreateOrganizationType", () => {
  it("lets Pollar create a store when the client requests it", () => {
    assert.equal(
      resolveCreateOrganizationType({
        requestedType: "store",
        taxEntity: null,
        pollarPath: true,
      }),
      "store",
    );
  });

  it("defaults Pollar to ngo when type is omitted", () => {
    assert.equal(
      resolveCreateOrganizationType({
        requestedType: undefined,
        taxEntity: null,
        pollarPath: true,
      }),
      "ngo",
    );
  });

  it("keeps explicit ngo on Pollar", () => {
    assert.equal(
      resolveCreateOrganizationType({
        requestedType: "ngo",
        taxEntity: "private_company",
        pollarPath: true,
      }),
      "ngo",
    );
  });

  it("maps private_company tax to store on the passkey path", () => {
    assert.equal(
      resolveCreateOrganizationType({
        requestedType: undefined,
        taxEntity: "private_company",
        pollarPath: false,
      }),
      "store",
    );
  });
});
