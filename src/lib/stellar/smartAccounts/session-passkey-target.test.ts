import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { sessionPasskeyConnectTarget } from "./sessionWallet.js";

describe("sessionPasskeyConnectTarget", () => {
  it("is null when there is no session (logged out / Pollar with no passkey yet)", () => {
    assert.equal(sessionPasskeyConnectTarget(null), null);
  });

  it("is null when the user has no passkey or member contract", () => {
    assert.equal(
      sessionPasskeyConnectTarget({
        loginCredentialId: null,
        signingCredentialId: null,
        memberContractId: null,
        username: null,
        smartWalletReady: false,
      }),
      null,
    );
  });

  it("requires both credential and contract", () => {
    assert.equal(
      sessionPasskeyConnectTarget({
        loginCredentialId: "cred-1",
        signingCredentialId: null,
        memberContractId: null,
        username: null,
        smartWalletReady: false,
      }),
      null,
    );
  });

  it("returns ids when both are present", () => {
    assert.deepEqual(
      sessionPasskeyConnectTarget({
        loginCredentialId: "cred-1",
        signingCredentialId: "sign-1",
        memberContractId: "CABC",
        username: "ada",
        smartWalletReady: true,
      }),
      { credentialId: "sign-1", contractId: "CABC" },
    );
  });
});
