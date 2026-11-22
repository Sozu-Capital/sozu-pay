import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  classifyDeviceKeys,
  extractCompressedPublicKeys,
  isCompressedDevicePublicKey,
  isPollarSessionAuthError,
  normalizeDevicePublicKey,
  pollarErrorMessage,
  turnkeyMatchBlockedReason,
} from "./device-keys.js";

const IPHONE = "03f284375ddc5ad0cf2ce01d03ba3c1442300d44a32274701076891dcd3ac829a6";
const MAC = "028f430ff4ddd3bf07e0b0abadebe446f27f40b736a42b212dee837ee65b2e4793";
const ORIGINAL = `02${"aa".repeat(32)}`;

describe("device public keys", () => {
  it("normalizes 0x-prefixed compressed keys", () => {
    assert.equal(normalizeDevicePublicKey(`0x${IPHONE.toUpperCase()}`), IPHONE);
    assert.equal(isCompressedDevicePublicKey(IPHONE), true);
    assert.equal(isCompressedDevicePublicKey("GDA4BWUMZU4IXBF6W5Q4DWPMINZQHR7CIROPKIKVC72RTLZUP3W2WOPF"), false);
  });

  it("extracts compressed keys from nested Pollar device payloads", () => {
    const keys = extractCompressedPublicKeys({
      devices: [
        { publicKey: IPHONE, label: "iPhone Arc" },
        { credential: { public_key: `0x${MAC}` } },
      ],
      enrollments: [],
      noise: "6139031957eb52ce67a486a292bc5a5d",
    });
    assert.deepEqual(new Set(keys), new Set([IPHONE, MAC]));
  });

  it("flags a regenerated local key as not the enrolled Turnkey device", () => {
    const match = classifyDeviceKeys({
      localPublicKeys: [IPHONE, MAC],
      enrolledPublicKeys: [ORIGINAL],
    });
    assert.equal(match.thisDeviceEnrolled, false);
    assert.deepEqual(match.unenrolledLocalKeys, [IPHONE, MAC]);
    assert.deepEqual(match.enrolledOnlyKeys, [ORIGINAL]);
  });

  it("recognizes this browser when IndexedDB still has the enrolled key", () => {
    const match = classifyDeviceKeys({
      localPublicKeys: [IPHONE],
      enrolledPublicKeys: [`0x${IPHONE.toUpperCase()}`],
    });
    assert.equal(match.thisDeviceEnrolled, true);
    assert.deepEqual(match.enrolledLocalKeys, [IPHONE]);
  });

  it("reads Pollar refusal text", () => {
    assert.match(
      pollarErrorMessage({ body: { message: "This device isn't part of your wallet yet" } }),
      /isn't part of your wallet/,
    );
  });

  it("does not treat an auth failure as an empty enrolled-key list", () => {
    assert.equal(isPollarSessionAuthError("SDK_AUTH_INVALID_TOKEN"), true);
    assert.equal(
      turnkeyMatchBlockedReason({
        authStep: "authenticated",
        authVerified: false,
        devicesError: null,
      }),
      "pollar_login_required",
    );
    assert.equal(
      turnkeyMatchBlockedReason({
        authStep: "idle",
        authVerified: false,
        devicesError: null,
      }),
      "pollar_login_required",
    );
    assert.equal(
      turnkeyMatchBlockedReason({
        authStep: "authenticated",
        authVerified: true,
        devicesError: "SDK_AUTH_INVALID_TOKEN",
      }),
      "pollar_login_required",
    );
    assert.equal(
      turnkeyMatchBlockedReason({
        authStep: "authenticated",
        authVerified: true,
        devicesError: "SDK_COSIGN_UPSTREAM_ERROR",
      }),
      "turnkey_unreachable",
    );
    assert.equal(
      turnkeyMatchBlockedReason({
        authStep: "authenticated",
        authVerified: true,
        devicesError: null,
      }),
      null,
    );
  });
});
