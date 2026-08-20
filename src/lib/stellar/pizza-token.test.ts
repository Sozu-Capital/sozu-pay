import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  PIZZA_DECIMALS,
  PIZZA_NAME,
  PIZZA_PREMINT,
  PIZZA_SYMBOL,
  getPizzaTokenId,
  isPizzaTokenConfigured,
  pizzaAmountToI128,
} from "./pizza-token.js";

const CIRCLE_USDC_SAC = "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA";

describe("PizzaToken config", () => {
  it("is a 0-decimal SEP-41 with symbol PIZZA and premint 20", () => {
    assert.equal(PIZZA_NAME, "Pizza");
    assert.equal(PIZZA_SYMBOL, "PIZZA");
    assert.equal(PIZZA_DECIMALS, 0);
    assert.equal(PIZZA_PREMINT, 20);
  });

  it("encodes a redeem of 1 PIZZA as i128 1, not 10^7 stroops", () => {
    assert.equal(pizzaAmountToI128(1), 1n);
    assert.equal(pizzaAmountToI128("1"), 1n);
  });

  it("isPizzaTokenConfigured is true only when the pizza contract id is set", () => {
    const prev = process.env.SOROBAN_PIZZA_TOKEN_ID;
    delete process.env.SOROBAN_PIZZA_TOKEN_ID;
    try {
      assert.equal(isPizzaTokenConfigured(), false);
      process.env.SOROBAN_PIZZA_TOKEN_ID =
        "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4";
      assert.equal(isPizzaTokenConfigured(), true);
    } finally {
      if (prev === undefined) delete process.env.SOROBAN_PIZZA_TOKEN_ID;
      else process.env.SOROBAN_PIZZA_TOKEN_ID = prev;
    }
  });

  it("reads SOROBAN_PIZZA_TOKEN_ID and never falls back to Circle USDC", () => {
    const prevPizza = process.env.SOROBAN_PIZZA_TOKEN_ID;
    const prevUsdc = process.env.SOROBAN_USDC_TOKEN_ID;
    process.env.SOROBAN_USDC_TOKEN_ID = CIRCLE_USDC_SAC;
    delete process.env.SOROBAN_PIZZA_TOKEN_ID;
    try {
      assert.throws(() => getPizzaTokenId(), /SOROBAN_PIZZA_TOKEN_ID/);
      process.env.SOROBAN_PIZZA_TOKEN_ID =
        "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4";
      assert.equal(
        getPizzaTokenId(),
        "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4",
      );
      assert.notEqual(getPizzaTokenId(), CIRCLE_USDC_SAC);
    } finally {
      if (prevPizza === undefined) delete process.env.SOROBAN_PIZZA_TOKEN_ID;
      else process.env.SOROBAN_PIZZA_TOKEN_ID = prevPizza;
      if (prevUsdc === undefined) delete process.env.SOROBAN_USDC_TOKEN_ID;
      else process.env.SOROBAN_USDC_TOKEN_ID = prevUsdc;
    }
  });
});
