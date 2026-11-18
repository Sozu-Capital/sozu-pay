import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  POLLAR_SDK_API_VERSION,
  pollarLoginTimeoutMs,
  pollarSdkApiPath,
  pollarStellarNetworkFromEnv,
  pollarStellarNetworkFromPublishableKey,
  resolvePollarStellarNetwork,
} from "./network.js";

describe("Pollar stellar network", () => {
  it("reads mainnet from a live publishable key even if Stellar env is testnet", () => {
    assert.equal(
      resolvePollarStellarNetwork({
        apiKey: "pub_mainnet_abc",
        stellarNetwork: "testnet",
      }),
      "mainnet",
    );
    assert.equal(pollarStellarNetworkFromPublishableKey("pub_mainnet_abc"), "mainnet");
  });

  it("reads testnet from a test publishable key", () => {
    assert.equal(
      resolvePollarStellarNetwork({
        apiKey: "pub_testnet_abc",
        stellarNetwork: "public",
      }),
      "testnet",
    );
  });

  it("falls back to NEXT_PUBLIC_STELLAR_NETWORK=public when the key has no prefix", () => {
    assert.equal(
      pollarStellarNetworkFromEnv({
        NEXT_PUBLIC_POLLAR_PUBLISHABLE_KEY: "pk_live_unprefixed",
        NEXT_PUBLIC_STELLAR_NETWORK: "public",
      }),
      "mainnet",
    );
  });

  it("defaults to testnet when nothing is configured", () => {
    assert.equal(pollarStellarNetworkFromEnv({}), "testnet");
  });

  it("uses a longer login timeout on mainnet wallet setup", () => {
    assert.equal(pollarLoginTimeoutMs("mainnet"), 120_000);
    assert.equal(pollarLoginTimeoutMs("testnet"), 90_000);
  });

  it("builds SDK v3 paths for hosted OAuth complete", () => {
    assert.equal(POLLAR_SDK_API_VERSION, "v3");
    assert.equal(pollarSdkApiPath("/auth/login"), "/v3/auth/login");
    assert.equal(
      pollarSdkApiPath("auth/session/status/sess-9/poll"),
      "/v3/auth/session/status/sess-9/poll",
    );
  });
});
