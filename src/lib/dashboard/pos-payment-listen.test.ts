import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { posListenPhaseFromStatus } from "./pos-payment-listen.js";

describe("posListenPhaseFromStatus", () => {
  it("stays waiting while pending and not expired", () => {
    assert.equal(
      posListenPhaseFromStatus({
        status: "pending",
        expiresAt: "2099-01-01T00:00:00.000Z",
      }),
      "waiting",
    );
  });

  it("transitions to paid only on completed", () => {
    assert.equal(
      posListenPhaseFromStatus({
        status: "completed",
        expiresAt: "2020-01-01T00:00:00.000Z",
      }),
      "paid",
    );
  });

  it("treats TTL expiry as expired, never paid", () => {
    assert.equal(
      posListenPhaseFromStatus(
        { status: "pending", expiresAt: "2020-01-01T00:00:00.000Z" },
        Date.parse("2026-08-14T00:00:00.000Z"),
      ),
      "expired",
    );
  });

  it("maps failed without implying paid", () => {
    assert.equal(posListenPhaseFromStatus({ status: "failed" }), "failed");
  });
});
