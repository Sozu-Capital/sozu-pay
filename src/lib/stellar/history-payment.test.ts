import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { historyMovementFromOperation, isPositiveAmount } from "./history-payment.js";

const STORE = "GDFOSTOREACCOUNT";
const CONTRACT = "CDJVTREASURY";

describe("historyMovementFromOperation", () => {
  it("reads a contract USDC transfer into the store", () => {
    const row = historyMovementFromOperation(
      {
        type: "invoke_host_function",
        transaction_hash: "abc123",
        created_at: "2026-11-17T16:40:56Z",
        asset_balance_changes: [
          { type: "transfer", asset_code: "USDC", amount: "5.0000000", from: CONTRACT, to: STORE },
        ],
      },
      STORE,
    );
    assert.equal(row?.amount, "5.0000000");
    assert.equal(row?.type, "incoming");
    assert.equal(row?.counterpartyAddress, CONTRACT);
    assert.equal(row?.id, "abc123");
  });

  it("reads a contract USDC transfer out of the store", () => {
    const row = historyMovementFromOperation(
      {
        type: "invoke_host_function",
        transaction_hash: "def456",
        created_at: "2026-11-17T15:46:21Z",
        asset_balance_changes: [
          { type: "transfer", asset_code: "USDC", amount: "3.4000000", from: STORE, to: CONTRACT },
        ],
      },
      STORE,
    );
    assert.equal(row?.type, "payout");
    assert.equal(row?.amount, "3.4000000");
    assert.equal(row?.counterpartyAddress, CONTRACT);
  });

  it("drops account creation and other non-USDC operations", () => {
    assert.equal(
      historyMovementFromOperation(
        {
          type: "create_account",
          transaction_hash: "fund",
          created_at: "2026-11-17T04:02:31Z",
        },
        STORE,
      ),
      null,
    );
    assert.equal(
      historyMovementFromOperation(
        {
          type: "payment",
          transaction_hash: "xlm",
          amount: "10000.0000000",
          asset_type: "native",
          from: "GFOUNDER",
          to: STORE,
        },
        STORE,
      ),
      null,
    );
    assert.equal(
      historyMovementFromOperation(
        {
          type: "invoke_host_function",
          transaction_hash: "empty",
          asset_balance_changes: [],
        },
        STORE,
      ),
      null,
    );
  });

  it("keeps a classic USDC payment and ignores a zero amount", () => {
    const row = historyMovementFromOperation(
      {
        type: "payment",
        transaction_hash: "pay1",
        created_at: "2026-11-17T12:00:00Z",
        amount: "4.50",
        asset_code: "USDC",
        from: "GPAYER",
        to: STORE,
      },
      STORE,
    );
    assert.equal(row?.type, "incoming");
    assert.equal(row?.amount, "4.50");
    assert.equal(isPositiveAmount("0"), false);
    assert.equal(isPositiveAmount("0.0000000"), false);
    assert.equal(
      historyMovementFromOperation(
        {
          type: "payment",
          transaction_hash: "zero",
          amount: "0",
          asset_code: "USDC",
          from: "GPAYER",
          to: STORE,
        },
        STORE,
      ),
      null,
    );
  });
});
