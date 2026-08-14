import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  SOZU_FAUCET_POW_PREFIX,
  solveSozuFaucetPow,
  verifyPowSolution,
} from "./pow.js";

describe("sozu faucet pow", () => {
  it("solves a low-difficulty challenge", () => {
    const challengeId = "test-challenge";
    const to = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";
    const difficulty = 8;
    const nonce = solveSozuFaucetPow({
      prefix: SOZU_FAUCET_POW_PREFIX,
      challengeId,
      to,
      difficulty,
    });
    assert.ok(verifyPowSolution({
      prefix: SOZU_FAUCET_POW_PREFIX,
      challengeId,
      to,
      nonce,
      difficulty,
    }));
  });
});
