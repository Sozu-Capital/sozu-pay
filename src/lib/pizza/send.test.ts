import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildPizzaPayoutTransfer } from "./send.js";

const CIRCLE_USDC_SAC = "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA";
const PIZZA_ID = "CDLIQJFEKJ4HGDQ7I5KOAVXOIZLCMVVICRMPK2LL3GE6PL53BQWGS4F6";
const STORE_G = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";
const WALLET_C = "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4";

describe("buildPizzaPayoutTransfer", () => {
  it("transfers N PIZZA from store treasury to an app.sozu.capital wallet", () => {
    const call = buildPizzaPayoutTransfer({
      pizzaTokenId: PIZZA_ID,
      fromStore: STORE_G,
      toWallet: WALLET_C,
      amount: "5",
    });
    assert.equal(call.contractId, PIZZA_ID);
    assert.equal(call.method, "transfer");
    assert.equal(call.from, STORE_G);
    assert.equal(call.to, WALLET_C);
    assert.equal(call.amount, 5n);
    assert.notEqual(call.contractId, CIRCLE_USDC_SAC);
  });
});
