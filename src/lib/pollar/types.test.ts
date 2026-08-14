import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Keypair } from "@stellar/stellar-sdk";
import {
  FAKE_POLLAR_STAFF_WALLET,
  isFakePollarStaffWallet,
  usableClassicTreasuryPublicKey,
} from "./types.js";

describe("fake Pollar staff wallet sentinel", () => {
  it("detects the known stub G", () => {
    assert.equal(isFakePollarStaffWallet(FAKE_POLLAR_STAFF_WALLET), true);
    assert.equal(isFakePollarStaffWallet(FAKE_POLLAR_STAFF_WALLET.toLowerCase()), true);
    assert.equal(isFakePollarStaffWallet(Keypair.random().publicKey()), false);
  });

  it("usableClassicTreasuryPublicKey rejects the stub and junk", () => {
    assert.equal(usableClassicTreasuryPublicKey(FAKE_POLLAR_STAFF_WALLET), null);
    assert.equal(usableClassicTreasuryPublicKey(null), null);
    assert.equal(usableClassicTreasuryPublicKey("not-a-key"), null);
  });

  it("usableClassicTreasuryPublicKey accepts a real G", () => {
    const real = Keypair.random().publicKey();
    assert.equal(usableClassicTreasuryPublicKey(real), real);
  });
});
