import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { evaluateDisbursementFunds } from "./disbursement-paying-balance";

const CONTRACT_A = "C" + "A".repeat(55);
const CONTRACT_B = "C" + "B".repeat(55);

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

describe("send-invites treasury gate", () => {
  it("does not require a Soroban contract", () => {
    const source = stripComments(
      readFileSync(
        path.resolve(
          import.meta.dirname,
          "../../app/api/sdp/disbursements/[id]/send-invites/route.ts",
        ),
        "utf8",
      ),
    );
    assert.equal(source.includes("validateDisbursementFunds"), false);
    assert.equal(source.includes("NO_ORG_TREASURY"), false);
    assert.equal(source.includes("soroban_contract_id"), false);
    assert.equal(source.includes("treasury_contract_id"), false);
  });
});

describe("Distribuir paying wallet", () => {
  it("does not ignore a G treasury when a C id is also set", () => {
    const result = evaluateDisbursementFunds({
      required: 40,
      treasuryId: CONTRACT_A,
      disbursementContractId: CONTRACT_A,
      treasuryBal: 0,
      disbursementBal: 0,
      classicGBal: 40,
    });
    assert.deepEqual(result, { ok: true });
  });

  it("refuses a batch when neither the G wallet nor the resolver contracts can cover it", () => {
    const result = evaluateDisbursementFunds({
      required: 50,
      treasuryId: CONTRACT_A,
      disbursementContractId: CONTRACT_A,
      treasuryBal: 30,
      disbursementBal: 30,
      classicGBal: 30,
    });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.code, "INSUFFICIENT_ORG_BALANCE");
    assert.equal(typeof result.error, "string");
    assert.deepEqual(result.details, { required: 50, orgBalance: 30 });
  });

  it("still combines only the treasury and disbursement resolver balances", () => {
    const covered = evaluateDisbursementFunds({
      required: 90,
      treasuryId: CONTRACT_A,
      disbursementContractId: CONTRACT_B,
      treasuryBal: 50,
      disbursementBal: 40,
      classicGBal: 0,
    });
    assert.deepEqual(covered, { ok: true });
  });

  it("still refuses Distribuir when the resolvers find no contract", () => {
    const result = evaluateDisbursementFunds({
      required: 10,
      treasuryId: null,
      disbursementContractId: null,
      treasuryBal: 0,
      disbursementBal: 0,
      classicGBal: 100,
    });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.code, "NO_ORG_TREASURY");
    assert.equal(typeof result.error, "string");
    assert.equal(result.details, undefined);
  });
});

describe("validateDisbursementFunds wiring", () => {
  it("reads the resolver contracts and the classic G, and does not sum every C id", () => {
    const source = stripComments(
      readFileSync(path.resolve(import.meta.dirname, "./validateDisbursementStart.ts"), "utf8"),
    );
    assert.match(source, /resolveOrgTreasuryContractId/);
    assert.match(source, /resolveOrgDisbursementContractId/);
    assert.match(source, /getUsdcBalance\(classicG\)/);
    assert.equal(source.includes("collectOrgBatchTreasuryHolders"), false);
    assert.equal(source.includes("treasury_smart_account_address"), false);
    assert.equal(source.includes("contractIds"), false);
  });
});
