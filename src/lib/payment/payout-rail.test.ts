import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertHorizonPaymentDestination,
  payoutRailForDestination,
} from "./payout-rail.js";

const CLASSIC_G = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";
const CONTRACT_C = "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4";

describe("payoutRailForDestination", () => {
  it("routes classic G through Horizon Payment", () => {
    assert.equal(payoutRailForDestination(CLASSIC_G), "classic");
  });

  it("routes smart-account C through SAC transfer", () => {
    assert.equal(payoutRailForDestination(CONTRACT_C), "sac");
  });

  it("returns null for sozu tags and garbage", () => {
    assert.equal(payoutRailForDestination("$maria"), null);
    assert.equal(payoutRailForDestination("not-an-address"), null);
  });
});

describe("assertHorizonPaymentDestination", () => {
  it("accepts a classic G address", () => {
    assert.equal(assertHorizonPaymentDestination(CLASSIC_G), CLASSIC_G);
  });

  it("rejects a C address with the prod symptom (destination is invalid)", () => {
    assert.throws(
      () => assertHorizonPaymentDestination(CONTRACT_C),
      /destination is invalid/,
    );
  });
});
