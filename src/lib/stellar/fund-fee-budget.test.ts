import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { FEE_BUDGET_MIN_SPENDABLE_XLM } from "@/lib/stellar/fund.js";

describe("FEE_BUDGET_MIN_SPENDABLE_XLM", () => {
  it("requires enough headroom for Pollar/SAC fees after reserves", () => {
    assert.ok(FEE_BUDGET_MIN_SPENDABLE_XLM >= 2);
  });
});
