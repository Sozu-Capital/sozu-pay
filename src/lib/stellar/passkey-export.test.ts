import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { openStellarSecret, sealStellarSecret } from "./passkey-export";

describe("passkey export blob", () => {
  it("round-trips a Stellar secret and fails with a different passkey key", async () => {
    const prf = crypto.getRandomValues(new Uint8Array(32));
    const secret = "SA".padEnd(56, "X");
    const blob = await sealStellarSecret(secret, prf);
    assert.equal(blob.includes(secret), false);
    assert.equal(await openStellarSecret(blob, prf), secret);

    const other = crypto.getRandomValues(new Uint8Array(32));
    await assert.rejects(openStellarSecret(blob, other));
  });
});
