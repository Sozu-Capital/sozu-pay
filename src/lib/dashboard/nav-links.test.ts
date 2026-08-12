import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ngoDashboardNavLinks,
  storeDashboardNavLinks,
  storeHomeActions,
} from "./nav-links.js";

describe("storeDashboardNavLinks", () => {
  it("includes POS and QR & NFC, not Get paid / checkout", () => {
    const links = storeDashboardNavLinks();
    const hrefs = links.map((l) => l.href);
    const kinds = links.map((l) => l.kind);

    assert.ok(hrefs.includes("/dashboard/pos"));
    assert.ok(hrefs.includes("/dashboard/qr-codes"));
    assert.ok(kinds.includes("pos"));
    assert.equal(kinds.filter((k) => k === "pos").length, 1);

    assert.ok(!hrefs.includes("/dashboard/checkout"));
    assert.ok(!kinds.includes("funding-links"));
  });
});

describe("storeHomeActions", () => {
  it("offers POS as the create-charge action and keeps QR & NFC", () => {
    const actions = storeHomeActions();
    const hrefs = actions.map((a) => a.href);
    const kinds = actions.map((a) => a.kind);

    assert.equal(kinds[0], "pos");
    assert.ok(hrefs.includes("/dashboard/pos"));
    assert.ok(hrefs.includes("/dashboard/qr-codes"));
    assert.ok(!hrefs.includes("/dashboard/checkout"));
  });
});

describe("ngoDashboardNavLinks", () => {
  it("keeps Funding link at checkout", () => {
    const links = ngoDashboardNavLinks({ showDisbursements: true });
    assert.ok(links.some((l) => l.href === "/dashboard/checkout" && l.kind === "funding-links"));
    assert.ok(!links.some((l) => l.kind === "pos"));
  });
});
