import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  POLLAR_SERVER_API_ORIGIN,
  pollarTokenVerifyUrl,
  resolvePollarServerBase,
} from "./adapter.js";

describe("Pollar server API base", () => {
  it("defaults to server.api.pollar.xyz", () => {
    assert.equal(resolvePollarServerBase(), POLLAR_SERVER_API_ORIGIN);
    assert.equal(resolvePollarServerBase(""), POLLAR_SERVER_API_ORIGIN);
    assert.equal(pollarTokenVerifyUrl(), "https://server.api.pollar.xyz/v3/tokens/verify");
  });

  it("rewrites the retired api.pollar.xyz host", () => {
    assert.equal(resolvePollarServerBase("https://api.pollar.xyz"), POLLAR_SERVER_API_ORIGIN);
    assert.equal(
      pollarTokenVerifyUrl("https://api.pollar.xyz/v1"),
      "https://server.api.pollar.xyz/v3/tokens/verify",
    );
  });

  it("strips a trailing version so verify is always /v3/tokens/verify", () => {
    assert.equal(
      pollarTokenVerifyUrl("https://server.api.pollar.xyz/v1/"),
      "https://server.api.pollar.xyz/v3/tokens/verify",
    );
    assert.equal(
      pollarTokenVerifyUrl("https://server.api.pollar.xyz/v3"),
      "https://server.api.pollar.xyz/v3/tokens/verify",
    );
  });
});
