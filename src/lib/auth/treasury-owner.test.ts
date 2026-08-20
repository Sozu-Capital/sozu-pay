import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Keypair } from "@stellar/stellar-sdk";
import { isOrgTreasuryOwner, isTreasuryAdminMemberRole } from "./treasury-owner.js";

describe("isOrgTreasuryOwner", () => {
  const home = Keypair.random().publicKey();
  const other = Keypair.random().publicKey();

  it("matches the Pollar wallet bound as Home treasury", () => {
    assert.equal(
      isOrgTreasuryOwner(
        { id: 48, stellar_public_key: home },
        { treasury_manager_user_id: null, stellar_disbursement_public_key: home },
      ),
      true,
    );
  });

  it("rejects another org admin whose Pollar wallet is not Home treasury", () => {
    assert.equal(
      isOrgTreasuryOwner(
        { id: 48, stellar_public_key: other },
        { treasury_manager_user_id: 47, stellar_disbursement_public_key: home },
      ),
      false,
    );
  });

  it("accepts treasury_manager_user_id when the column is set", () => {
    assert.equal(
      isOrgTreasuryOwner(
        { id: 47, stellar_public_key: other },
        { treasury_manager_user_id: 47, stellar_disbursement_public_key: home },
      ),
      true,
    );
  });

  it("is false with no org", () => {
    assert.equal(isOrgTreasuryOwner({ id: 1, stellar_public_key: home }, null), false);
  });

  it("accepts org_members treasury_manager so an invited treasurer can pay", () => {
    assert.equal(isTreasuryAdminMemberRole("treasury_manager"), true);
    assert.equal(isTreasuryAdminMemberRole("member"), false);
    assert.equal(
      isOrgTreasuryOwner(
        { id: 99, stellar_public_key: other },
        { treasury_manager_user_id: 47, stellar_disbursement_public_key: home },
        "treasury_manager",
      ),
      true,
    );
  });
});
