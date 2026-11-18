import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { pollarBrowserClientConfig } from "./browser-client.js";

describe("pollarBrowserClientConfig", () => {
  it("passes stellarNetwork from the publishable key, not a copied process.env object", () => {
    const mainnet = pollarBrowserClientConfig("pub_mainnet_live");
    assert.equal(mainnet.stellarNetwork, "mainnet");
    assert.equal(mainnet.loginTimeoutMs, 120_000);

    const testnet = pollarBrowserClientConfig("pub_testnet_dev");
    assert.equal(testnet.stellarNetwork, "testnet");
    assert.equal(testnet.loginTimeoutMs, 90_000);
  });
});
