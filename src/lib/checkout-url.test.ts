import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { checkoutSessionUrl, getCheckoutBaseUrl } from "./checkout-url.js";
import { namedCheckoutUrl, storeLandingUrl } from "./named-checkout/urls.js";

describe("getCheckoutBaseUrl", () => {
  it("uses the SozuPay app URL, not SozuCredit", () => {
    const prevApp = process.env.NEXT_PUBLIC_APP_URL;
    const prevCreditServer = process.env.SOZUCREDIT_URL;
    process.env.NEXT_PUBLIC_APP_URL = "https://pay.sozu.capital";
    process.env.SOZUCREDIT_URL = "https://credit.sozu.capital";
    try {
      assert.equal(getCheckoutBaseUrl(), "https://pay.sozu.capital");
      assert.equal(
        checkoutSessionUrl("cs_test"),
        "https://pay.sozu.capital/checkout/cs_test",
      );
      assert.equal(
        namedCheckoutUrl("maria_cafe", "almuerzo"),
        "https://pay.sozu.capital/maria_cafe/almuerzo",
      );
      assert.equal(storeLandingUrl("maria_cafe"), "https://pay.sozu.capital/maria_cafe");
    } finally {
      if (prevApp === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
      else process.env.NEXT_PUBLIC_APP_URL = prevApp;
      if (prevCreditServer === undefined) delete process.env.SOZUCREDIT_URL;
      else process.env.SOZUCREDIT_URL = prevCreditServer;
    }
  });

  it("does not use credit.sozu.capital as checkout host when misconfigured", () => {
    const prevApp = process.env.NEXT_PUBLIC_APP_URL;
    process.env.NEXT_PUBLIC_APP_URL = "https://credit.sozu.capital";
    try {
      // Falls through to request origin when env is the wallet host.
      assert.equal(
        getCheckoutBaseUrl({ url: "https://pay.sozu.capital/api/checkout/create" } as never),
        "https://pay.sozu.capital",
      );
    } finally {
      if (prevApp === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
      else process.env.NEXT_PUBLIC_APP_URL = prevApp;
    }
  });
});
