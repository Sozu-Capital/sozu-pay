import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CHECKOUT_PERSIST_FAILED_CODE,
  buildPaymentRequestResponse,
  checkoutPersistFailureBody,
  decideIdempotentReplay,
  parsePaymentRequestBody,
} from "./create-payment-request.js";
import { buildClpPricingQuote } from "../pos/clp-pricing.js";

describe("parsePaymentRequestBody", () => {
  it("accepts whole-peso amountClp and Idempotency-Key header", () => {
    const parsed = parsePaymentRequestBody(
      { amountClp: "12500", reference: "mesa-4" },
      " pos-key-1 ",
    );
    assert.ok(!("status" in parsed));
    assert.deepEqual(parsed, {
      amount: { kind: "clp", amountClp: "12500" },
      reference: "mesa-4",
      paymentMethod: undefined,
      allowDebit: true,
      allowCredit: true,
      allowBankTransfer: true,
      idempotencyKey: "pos-key-1",
    });
  });

  it("rejects fractional or non-positive CLP", () => {
    const bad = parsePaymentRequestBody({ amountClp: "12.5" });
    assert.ok("status" in bad);
    assert.equal(bad.status, 400);
    assert.equal(bad.code, "INVALID_AMOUNT");
  });

  it("rejects missing amounts", () => {
    const bad = parsePaymentRequestBody({});
    assert.ok("status" in bad);
    assert.equal(bad.code, "INVALID_AMOUNT");
  });

  it("still accepts legacy amountUsd for funding links", () => {
    const parsed = parsePaymentRequestBody({ amountUsd: "10.00" });
    assert.ok(!("status" in parsed));
    assert.equal(parsed.amount.kind, "usd");
  });
});

describe("decideIdempotentReplay", () => {
  it("replays when CLP amount matches", () => {
    const request = parsePaymentRequestBody({ amountClp: "9500" });
    assert.ok(!("status" in request));
    const priced = buildClpPricingQuote("9500", { envRate: "950" });
    assert.ok(priced);
    assert.equal(
      decideIdempotentReplay({
        existingAmountClp: "9500",
        existingAmountUsd: "10.00",
        request,
        priced,
      }).action,
      "replay",
    );
  });

  it("conflicts when the same key is reused with a different CLP amount", () => {
    const request = parsePaymentRequestBody({ amountClp: "10000" });
    assert.ok(!("status" in request));
    const priced = buildClpPricingQuote("10000", { envRate: "950" });
    const decision = decideIdempotentReplay({
      existingAmountClp: "9500",
      existingAmountUsd: "10.00",
      request,
      priced,
    });
    assert.equal(decision.action, "conflict");
  });
});

describe("buildPaymentRequestResponse", () => {
  it("includes stable id + checkout URL fields POS needs for QR/listen", () => {
    const res = buildPaymentRequestResponse({
      id: "cs_abc",
      checkoutUrl: "https://pay.sozu.capital/checkout/cs_abc",
      amountUsd: "10.00",
      amountClp: "9500",
      pricingCurrency: "CLP",
      clpPerUsdc: 950,
      fxSource: "POS_CLP_PER_USDC",
      reference: null,
      providerSessionId: "dep_1",
      expiresAt: null,
      idempotentReplay: false,
    });
    assert.equal(res.id, "cs_abc");
    assert.match(res.checkoutUrl, /\/checkout\/cs_abc$/);
    assert.equal(res.amountClp, "9500");
    assert.equal(res.idempotentReplay, false);
  });
});

describe("checkoutPersistFailureBody", () => {
  it("does not include a checkoutUrl when the session row was not saved", () => {
    const body = checkoutPersistFailureBody();
    assert.equal(body.code, CHECKOUT_PERSIST_FAILED_CODE);
    assert.equal("checkoutUrl" in body, false);
  });
});
