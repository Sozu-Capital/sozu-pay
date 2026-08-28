import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  parseClpAmount,
  reconciliationCsv,
  summarizeStoreReconciliation,
  type ReconciliationCharge,
} from "./reconciliation.js";

function charge(
  partial: Partial<ReconciliationCharge> & Pick<ReconciliationCharge, "id" | "amountClp" | "completedAt">,
): ReconciliationCharge {
  return {
    createdAt: partial.completedAt,
    amountUsd: null,
    stellarTxHash: null,
    reference: null,
    ...partial,
  };
}

describe("parseClpAmount", () => {
  it("parses whole pesos and rejects junk", () => {
    assert.equal(parseClpAmount("12400"), 12400);
    assert.equal(parseClpAmount(null), 0);
    assert.equal(parseClpAmount("-1"), 0);
  });
});

describe("summarizeStoreReconciliation", () => {
  it("splits today vs this week (America/Santiago)", () => {
    // Wednesday 26 Aug 2026 15:00 UTC = 11:00 Santiago (UTC-4 in Aug)
    const now = new Date("2026-08-26T15:00:00.000Z");
    const charges = [
      charge({ id: "today", amountClp: 1000, completedAt: "2026-08-26T14:00:00.000Z" }),
      charge({ id: "monday", amountClp: 500, completedAt: "2026-08-24T12:00:00.000Z" }),
      charge({ id: "last-week", amountClp: 9999, completedAt: "2026-08-21T12:00:00.000Z" }),
    ];
    const summary = summarizeStoreReconciliation(charges, now);
    assert.equal(summary.todayClp, 1000);
    assert.equal(summary.todayChargeCount, 1);
    assert.equal(summary.cycleClp, 1500);
    assert.equal(summary.cycleChargeCount, 2);
    assert.equal(summary.charges.length, 3);
  });
});

describe("reconciliationCsv", () => {
  it("emits a header and one row per charge", () => {
    const summary = summarizeStoreReconciliation(
      [charge({ id: "cs_1", amountClp: 10, completedAt: "2026-08-26T14:00:00.000Z", amountUsd: "0.01" })],
      new Date("2026-08-26T15:00:00.000Z"),
    );
    const csv = reconciliationCsv(summary);
    assert.match(csv, /^id,completed_at,amount_clp/);
    assert.match(csv, /cs_1,/);
    assert.match(csv, /,10,/);
  });
});
