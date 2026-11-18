import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { stellarHashFromPollarSubmit } from "./client-usdc-send.js";

const SOURCE = "GABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

describe("stellarHashFromPollarSubmit", () => {
  it("returns the hash for success and pending", () => {
    assert.equal(
      stellarHashFromPollarSubmit({ status: "success", hash: "abc" }, SOURCE, "fail"),
      "abc",
    );
    assert.equal(
      stellarHashFromPollarSubmit({ status: "pending", hash: "def" }, SOURCE, "fail"),
      "def",
    );
  });

  it("asks the user to approve a Turnkey co-sign instead of reading a missing hash", () => {
    assert.throws(
      () => stellarHashFromPollarSubmit({ status: "cosign_pending" }, SOURCE, "fail"),
      /Pollar confirmation prompt/,
    );
  });

  it("surfaces Pollar error codes", () => {
    assert.throws(
      () =>
        stellarHashFromPollarSubmit(
          { status: "error", message: "not ready", code: "SDK_WALLET_NOT_READY" },
          SOURCE,
          "fail",
        ),
      /SDK_WALLET_NOT_READY/,
    );
  });
});
