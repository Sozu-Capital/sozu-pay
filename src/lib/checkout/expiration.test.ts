import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_CHECKOUT_PAYMENT_TTL_MS,
  computeCheckoutExpiresAt,
  effectiveCheckoutStatus,
  getCheckoutPaymentTtlMs,
  isCheckoutExpired,
} from "./expiration.js";

describe("getCheckoutPaymentTtlMs", () => {
  it("uses env override or the 15-minute default", () => {
    assert.equal(getCheckoutPaymentTtlMs("60000"), 60_000);
    assert.equal(getCheckoutPaymentTtlMs(undefined), DEFAULT_CHECKOUT_PAYMENT_TTL_MS);
    assert.equal(getCheckoutPaymentTtlMs("nope"), DEFAULT_CHECKOUT_PAYMENT_TTL_MS);
  });
});

describe("isCheckoutExpired / computeCheckoutExpiresAt", () => {
  it("is false before the boundary and true at/after expiresAt", () => {
    const created = Date.parse("2026-08-14T12:00:00.000Z");
    const expiresAt = computeCheckoutExpiresAt(created, 60_000);
    assert.equal(expiresAt, "2026-08-14T12:01:00.000Z");
    assert.equal(isCheckoutExpired(expiresAt, created + 59_999), false);
    assert.equal(isCheckoutExpired(expiresAt, created + 60_000), true);
    assert.equal(isCheckoutExpired(expiresAt, created + 60_001), true);
  });

  it("treats missing expiresAt as not expired", () => {
    assert.equal(isCheckoutExpired(null), false);
    assert.equal(isCheckoutExpired(undefined), false);
  });
});

describe("effectiveCheckoutStatus", () => {
  it("maps pending+past TTL to expired without touching completed", () => {
    assert.equal(
      effectiveCheckoutStatus({
        status: "pending",
        expiresAt: "2020-01-01T00:00:00.000Z",
        now: Date.parse("2026-08-14T00:00:00.000Z"),
      }),
      "expired",
    );
    assert.equal(
      effectiveCheckoutStatus({
        status: "completed",
        expiresAt: "2020-01-01T00:00:00.000Z",
      }),
      "completed",
    );
    assert.equal(
      effectiveCheckoutStatus({
        status: "pending",
        expiresAt: "2099-01-01T00:00:00.000Z",
      }),
      "pending",
    );
  });
});
