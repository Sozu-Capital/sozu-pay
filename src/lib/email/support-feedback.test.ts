import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  SUPPORT_EMAIL,
  buildSupportFeedbackMail,
  feedbackReplyTo,
  normalizeFeedbackMessage,
  normalizeFeedbackPath,
} from "./support-feedback.js";

describe("support feedback mail", () => {
  it("keeps a short note and drops an empty or oversized one", () => {
    assert.equal(normalizeFeedbackMessage("  The QR card is great.  "), "The QR card is great.");
    assert.equal(normalizeFeedbackMessage("   "), null);
    assert.equal(normalizeFeedbackMessage("x".repeat(2001)), null);
  });

  it("accepts an in-app path only", () => {
    assert.equal(normalizeFeedbackPath("/dashboard/qr-codes"), "/dashboard/qr-codes");
    assert.equal(normalizeFeedbackPath("https://evil.example"), null);
    assert.equal(normalizeFeedbackPath("/dashboard\nBcc: evil"), null);
  });

  it("replies to the merchant and skips the passkey placeholder", () => {
    assert.equal(feedbackReplyTo("owner@northcafe.com"), "owner@northcafe.com");
    assert.equal(feedbackReplyTo("cafe@passkey.sozupay"), undefined);
  });

  it("addresses support@sozu.capital and includes the note, store, and page", () => {
    const mail = buildSupportFeedbackMail({
      message: "The price on the card is hard to read.",
      fromEmail: "owner@northcafe.com",
      orgName: "North Café",
      orgId: "org_123",
      path: "/dashboard/qr-codes",
    });
    assert.equal(mail.to, SUPPORT_EMAIL);
    assert.equal(mail.to, "support@sozu.capital");
    assert.equal(mail.replyTo, "owner@northcafe.com");
    assert.match(mail.subject, /North Café/);
    assert.match(mail.text, /The price on the card is hard to read\./);
    assert.match(mail.text, /Store: North Café/);
    assert.match(mail.text, /Page: \/dashboard\/qr-codes/);
  });
});
