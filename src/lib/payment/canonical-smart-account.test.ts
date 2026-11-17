import assert from "node:assert/strict";
import test from "node:test";
import {
  canonicalWriteDecision,
  pickTagOwner,
  selectCanonicalSmartAccount,
} from "./canonical-smart-account";

const OLD = "CDJVGT46QLTXLWY6GNWJ2UZOAWONZILHBKCF64E4AEEQRH3G4BA4AZ3F";
const NEWER = "CCJY33SGQ3VNQN52XLGSKFUDMTW4VG57527CFLQNSJKLLNRZVDDT2KGZ";
const CLASSIC = "GCFNUCUJ7WU32XGBP5A6GPDUYABQ7EXYBMSK7OEZG4YESBNNVG5BGTMJ";

test("stored smart account wins over a different org treasury", () => {
  assert.deepEqual(
    selectCanonicalSmartAccount({
      walletPublicKey: OLD,
      orgTreasuryContractId: NEWER,
    }),
    { contractId: OLD, source: "stellar_wallets" },
  );
});

test("org treasury is canonical only before a smart account exists", () => {
  assert.deepEqual(
    selectCanonicalSmartAccount({ walletPublicKey: null, orgTreasuryContractId: OLD }),
    { contractId: OLD, source: "org_treasury" },
  );
  assert.equal(selectCanonicalSmartAccount({ walletPublicKey: CLASSIC }), null);
});

test("the earliest wallet owns a case-variant tag", () => {
  const owner = pickTagOwner([
    { id: "new", username: "frankocean", walletCreatedAt: "2026-11-15T21:50:23.081Z" },
    { id: "old", username: "FrankOcean", walletCreatedAt: "2026-11-08T16:10:49.823Z" },
  ]);
  assert.equal(owner?.id, "old");
});

test("a second contract cannot replace the first", () => {
  assert.deepEqual(canonicalWriteDecision(OLD, NEWER), { action: "reject", contractId: OLD });
  assert.deepEqual(canonicalWriteDecision(OLD, OLD), { action: "keep", contractId: OLD });
  assert.deepEqual(canonicalWriteDecision(CLASSIC, NEWER), { action: "write", contractId: NEWER });
});
