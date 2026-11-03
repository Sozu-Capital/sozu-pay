import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  checkPayoutCaps,
  contractPayoutCapStroops,
  enforcePayoutCaps,
  readPayoutCaps,
  TESTNET_DEFAULT_CONTRACT_CAP_STROOPS,
  usdcToStroops,
} from "./caps";

const caps = { maxPerPayout: usdcToStroops("30")!, maxPerRun: usdcToStroops("600")! };

describe("usdcToStroops", () => {
  it("parses plain decimals exactly", () => {
    assert.equal(usdcToStroops("30"), BigInt(300000000));
    assert.equal(usdcToStroops("0.0000001"), BigInt(1));
    assert.equal(usdcToStroops("30.0000001"), BigInt(300000001));
  });

  it("rejects anything else", () => {
    for (const bad of ["", "-1", "1e3", "1.23456789", "abc", "1,5", "0x10", " . "]) {
      assert.equal(usdcToStroops(bad), null, bad);
    }
  });
});

describe("checkPayoutCaps", () => {
  it("allows payouts at the per-payout cap", () => {
    assert.deepEqual(checkPayoutCaps(["30"], caps), { ok: true, total: usdcToStroops("30") });
  });

  it("rejects a payout one stroop over the per-payout cap", () => {
    const result = checkPayoutCaps(["10", "30.0000001"], caps);
    assert.equal(result.ok, false);
    assert.equal(!result.ok && result.index, 1);
    assert.match(!result.ok ? result.error : "", /per-payout cap of 30 USDC/);
  });

  it("rejects a run whose total is over the per-run cap", () => {
    const run = Array.from({ length: 20 }, () => "30");
    assert.equal(checkPayoutCaps(run, caps).ok, true);
    const result = checkPayoutCaps([...run, "0.01"], caps);
    assert.equal(result.ok, false);
    assert.match(!result.ok ? result.error : "", /per-run cap of 600 USDC/);
  });

  it("rejects zero, negative and malformed amounts", () => {
    for (const bad of ["0", "-5", "NaN", "1e2"]) {
      assert.equal(checkPayoutCaps([bad], caps).ok, false, bad);
    }
  });
});

describe("readPayoutCaps", () => {
  it("fails closed on mainnet when a cap is missing", () => {
    assert.equal(readPayoutCaps({ STELLAR_NETWORK: "public" }).ok, false);
    assert.equal(readPayoutCaps({ STELLAR_NETWORK: "public", PAYOUT_MAX_PER_PAYOUT_USDC: "30" }).ok, false);
    assert.equal(enforcePayoutCaps(["1"], { STELLAR_NETWORK: "public" }).ok, false);
  });

  it("reads both caps on mainnet", () => {
    const result = readPayoutCaps({
      STELLAR_NETWORK: "public",
      PAYOUT_MAX_PER_PAYOUT_USDC: "30",
      PAYOUT_MAX_PER_RUN_USDC: "600",
    });
    assert.deepEqual(result, { ok: true, caps });
  });

  it("treats missing caps as none on testnet", () => {
    assert.deepEqual(readPayoutCaps({}), { ok: true, caps: { maxPerPayout: null, maxPerRun: null } });
    assert.equal(enforcePayoutCaps(["1000000"], {}).ok, true);
  });

  it("rejects malformed cap values everywhere", () => {
    assert.equal(readPayoutCaps({ PAYOUT_MAX_PER_PAYOUT_USDC: "lots" }).ok, false);
    assert.equal(readPayoutCaps({ PAYOUT_MAX_PER_RUN_USDC: "0" }).ok, false);
  });
});

describe("contractPayoutCapStroops", () => {
  it("uses the configured per-payout cap", () => {
    assert.equal(
      contractPayoutCapStroops({ STELLAR_NETWORK: "public", PAYOUT_MAX_PER_PAYOUT_USDC: "30", PAYOUT_MAX_PER_RUN_USDC: "600" }),
      usdcToStroops("30"),
    );
  });

  it("falls back to the testnet ceiling and refuses on unconfigured mainnet", () => {
    assert.equal(contractPayoutCapStroops({}), TESTNET_DEFAULT_CONTRACT_CAP_STROOPS);
    assert.throws(() => contractPayoutCapStroops({ STELLAR_NETWORK: "public" }));
  });
});
