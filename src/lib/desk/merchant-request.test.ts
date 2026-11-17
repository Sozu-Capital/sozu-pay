import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  arsCentsFor,
  canonicalEscrowAccount,
  canonicalSmartAccount,
  effectiveDeskTotalMinor,
  normalizeDeskBankAlias,
  readDeskCaps,
  usdcStringToMinor,
} from "./merchant-request.js";

const C = "C".padEnd(56, "A");
const G = "G".padEnd(56, "A");

describe("merchant desk request", () => {
  it("converts a USDC string into minor units", () => {
    assert.equal(usdcStringToMinor("10"), 100_000_000);
    assert.equal(usdcStringToMinor("10.50"), 105_000_000);
    assert.equal(usdcStringToMinor("0"), null);
    assert.equal(usdcStringToMinor("10.12345678"), null);
  });

  it("accepts a bank alias or account number without spaces", () => {
    assert.equal(normalizeDeskBankAlias("mi.alias"), "mi.alias");
    assert.equal(normalizeDeskBankAlias("123456"), "123456");
    assert.equal(normalizeDeskBankAlias("12 34"), null);
    assert.equal(normalizeDeskBankAlias("short"), null);
  });

  it("accepts only a C smart account and a G escrow", () => {
    assert.equal(canonicalSmartAccount(` ${C.toLowerCase()} `), C);
    assert.equal(canonicalSmartAccount(G), null);
    assert.equal(canonicalEscrowAccount(G), G);
    assert.equal(canonicalEscrowAccount(C), null);
  });

  it("prices 10 USDC at 1400 ARS as 14000 pesos", () => {
    assert.equal(arsCentsFor(100_000_000, 1400), 1_400_000);
  });

  it("uses pilot caps off mainnet and refuses an unconfigured mainnet", () => {
    const caps = readDeskCaps({ STELLAR_NETWORK: "testnet" });
    assert.ok(caps);
    assert.equal(caps.perOrderMinor, 300_000_000);
    assert.equal(readDeskCaps({ STELLAR_NETWORK: "public" }), null);
    assert.equal(
      effectiveDeskTotalMinor(
        { perOrderMinor: 1, perPersonMinor: 1, totalMinor: 600 * 10_000_000, totalArs: 1_000_000 },
        1400,
      ),
      Math.min(600 * 10_000_000, Math.floor((1_000_000 * 10_000_000) / 1400)),
    );
  });
});
