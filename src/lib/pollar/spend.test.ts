import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  FakeOrgSpendExecutor,
  ClientBoundOrgSpendExecutor,
  canServerExecuteOrgSpend,
} from "@/lib/pollar/spend";
import { FAKE_POLLAR_STAFF_WALLET } from "@/lib/pollar/types";

describe("FakeOrgSpendExecutor", () => {
  it("debits from Org treasury G and returns fake tx hashes", async () => {
    const executor = new FakeOrgSpendExecutor();
    const result = await executor.execute({
      fromAddress: FAKE_POLLAR_STAFF_WALLET,
      actingUserId: "42",
      payments: [
        {
          paymentId: "pay-1",
          toAddress: "GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB",
          amount: "10.5",
          recipientLabel: "Ana",
        },
      ],
    });
    assert.equal(result.fromAddress, FAKE_POLLAR_STAFF_WALLET);
    assert.equal(result.paymentCount, 1);
    assert.equal(result.txHashes.length, 1);
    assert.match(result.txHashes[0]!, /^fake-tx-42-pay-1$/);
    assert.equal(executor.calls.length, 1);
  });

  it("rejects empty payments and non-G fromAddress", async () => {
    const executor = new FakeOrgSpendExecutor();
    await assert.rejects(
      () =>
        executor.execute({
          fromAddress: "CXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
          actingUserId: "1",
          payments: [{ paymentId: "a", toAddress: "G…", amount: "1" }],
        }),
      /classic G-address/,
    );
    await assert.rejects(
      () =>
        executor.execute({
          fromAddress: FAKE_POLLAR_STAFF_WALLET,
          actingUserId: "1",
          payments: [],
        }),
      /No payments/,
    );
  });
});

describe("ClientBoundOrgSpendExecutor", () => {
  it("refuses server-only spend (NO-GO)", async () => {
    const executor = new ClientBoundOrgSpendExecutor();
    await assert.rejects(() => executor.execute(), /cannot spend Org treasury/);
  });
});

describe("canServerExecuteOrgSpend", () => {
  it("is true when POLLAR_FAKE_AUTH=true", () => {
    const prev = process.env.POLLAR_FAKE_AUTH;
    process.env.POLLAR_FAKE_AUTH = "true";
    try {
      assert.equal(canServerExecuteOrgSpend(), true);
    } finally {
      if (prev === undefined) delete process.env.POLLAR_FAKE_AUTH;
      else process.env.POLLAR_FAKE_AUTH = prev;
    }
  });
});
