import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { pollarSendPlan } from "./send-plan.js";

const CLASSIC_G = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";
const WALLET_C = "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4";
const PIZZA_ID = "CDLIQJFEKJ4HGDQ7I5KOAVXOIZLCMVVICRMPK2LL3GE6PL53BQWGS4F6";
const CIRCLE_USDC_SAC = "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA";

describe("pollarSendPlan", () => {
  it("sends PIZZA as SEP-41 even to a classic G app.sozu.capital wallet", () => {
    const plan = pollarSendPlan({
      asset: "PIZZA",
      destination: CLASSIC_G,
      amount: "3",
      pizzaTokenId: PIZZA_ID,
      usdcSacId: CIRCLE_USDC_SAC,
    });
    assert.equal(plan.kind, "sep41");
    if (plan.kind !== "sep41") return;
    assert.equal(plan.contractId, PIZZA_ID);
    assert.equal(plan.amountI128, "3");
    assert.notEqual(plan.contractId, CIRCLE_USDC_SAC);
  });

  it("sends PIZZA as SEP-41 to a smart-account C wallet", () => {
    const plan = pollarSendPlan({
      asset: "PIZZA",
      destination: WALLET_C,
      amount: "1",
      pizzaTokenId: PIZZA_ID,
    });
    assert.equal(plan.kind, "sep41");
    if (plan.kind !== "sep41") return;
    assert.equal(plan.contractId, PIZZA_ID);
    assert.equal(plan.amountI128, "1");
  });

  it("keeps USDC to G on classic payment", () => {
    const plan = pollarSendPlan({
      asset: "USDC",
      destination: CLASSIC_G,
      amount: "1.5",
    });
    assert.deepEqual(plan, { kind: "classic_usdc", amount: "1.5" });
  });

  it("sends USDC to C via Circle SAC with 7 decimals", () => {
    const plan = pollarSendPlan({
      asset: "USDC",
      destination: WALLET_C,
      amount: "1",
      usdcSacId: CIRCLE_USDC_SAC,
    });
    assert.equal(plan.kind, "sep41");
    if (plan.kind !== "sep41") return;
    assert.equal(plan.contractId, CIRCLE_USDC_SAC);
    assert.equal(plan.amountI128, "10000000");
  });
});
