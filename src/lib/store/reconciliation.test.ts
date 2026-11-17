import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  parseClpAmount,
  reconciliationCsv,
  summarizeStoreReconciliation,
  type ReconciliationCharge,
  type ReconciliationRedeem,
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

function redeem(
  partial: Partial<ReconciliationRedeem> & Pick<ReconciliationRedeem, "confirmedAt" | "status">,
): ReconciliationRedeem {
  return {
    amount: 1,
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
    assert.equal(summary.todayPizzaRedeemCount, 0);
    assert.equal(summary.cyclePizzaRedeemCount, 0);
  });

  it("POS-only orgs stay at 0 pizza redeems", () => {
    const now = new Date("2026-08-26T15:00:00.000Z");
    const summary = summarizeStoreReconciliation(
      [charge({ id: "pos", amountClp: 2500, completedAt: "2026-08-26T14:00:00.000Z" })],
      now,
      undefined,
      [],
    );
    assert.equal(summary.todayClp, 2500);
    assert.equal(summary.todayPizzaRedeemCount, 0);
    assert.equal(summary.cyclePizzaRedeemCount, 0);
  });

  it("counts confirmed (submitted) redeems and ignores pending", () => {
    const now = new Date("2026-08-26T15:00:00.000Z");
    const redeems = [
      redeem({ status: "submitted", confirmedAt: "2026-08-26T14:30:00.000Z" }),
      redeem({ status: "submitted", confirmedAt: "2026-08-25T12:00:00.000Z" }),
      redeem({ status: "pending", confirmedAt: "2026-08-26T14:45:00.000Z" }),
      redeem({ status: "signed", confirmedAt: "2026-08-26T14:50:00.000Z" }),
      redeem({ status: "submitted", confirmedAt: "2026-08-21T12:00:00.000Z" }),
    ];
    const summary = summarizeStoreReconciliation([], now, undefined, redeems);
    assert.equal(summary.todayClp, 0);
    assert.equal(summary.todayPizzaRedeemCount, 1);
    assert.equal(summary.cyclePizzaRedeemCount, 2);
  });
});

describe("reconciliationCsv", () => {
  it("emits a header and one row per charge with period pizza count", () => {
    const summary = summarizeStoreReconciliation(
      [charge({ id: "cs_1", amountClp: 10, completedAt: "2026-08-26T14:00:00.000Z", amountUsd: "0.01" })],
      new Date("2026-08-26T15:00:00.000Z"),
      undefined,
      [redeem({ status: "submitted", confirmedAt: "2026-08-26T14:30:00.000Z" })],
    );
    const csv = reconciliationCsv(summary);
    assert.match(csv, /^id,completed_at,amount_clp.*pizza_redeem_count/);
    assert.match(csv, /cs_1,/);
    assert.match(csv, /,10,/);
    assert.match(csv, /,1\n/);
  });

  it("emits a pizza period row when there are no charges", () => {
    const summary = summarizeStoreReconciliation(
      [],
      new Date("2026-08-26T15:00:00.000Z"),
      undefined,
      [redeem({ status: "submitted", confirmedAt: "2026-08-26T14:30:00.000Z" })],
    );
    const csv = reconciliationCsv(summary);
    assert.match(csv, /pizza_redeem_count/);
    assert.match(csv, /_pizza_period,/);
    assert.match(csv, /,1\n/);
  });
});
