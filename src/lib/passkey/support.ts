"use client";

import { logPasskeyEvent } from "@/lib/passkey/log";

export type PasskeySupportResult = {
  /** True when a local platform passkey prompt is likely to work. */
  localSupported: boolean;
  /** Human-readable reason when local passkey is unavailable. */
  reason?: string;
  code?: string;
};

/**
 * Detect whether this browser can prompt for a platform passkey locally.
 * When false, callers should offer QR cross-device signing.
 */
export async function detectPasskeySupport(): Promise<PasskeySupportResult> {
  if (typeof window === "undefined") {
    return { localSupported: false, reason: "Not in a browser.", code: "NOT_BROWSER" };
  }
  if (!window.isSecureContext) {
    logPasskeyEvent("warn", {
      action: "detect_support",
      reason: "insecure_context",
      userAgent: navigator.userAgent,
    });
    return {
      localSupported: false,
      reason: "Passkeys require HTTPS (secure context).",
      code: "INSECURE_CONTEXT",
    };
  }
  if (!window.PublicKeyCredential) {
    logPasskeyEvent("warn", {
      action: "detect_support",
      reason: "webauthn_unavailable",
      userAgent: navigator.userAgent,
    });
    return {
      localSupported: false,
      reason: "This browser does not support WebAuthn passkeys.",
      code: "WEBAUTHN_UNAVAILABLE",
    };
  }

  try {
    const platformAvailable =
      typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === "function"
        ? await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
        : false;

    if (!platformAvailable) {
      logPasskeyEvent("warn", {
        action: "detect_support",
        reason: "platform_authenticator_unavailable",
        userAgent: navigator.userAgent,
      });
      return {
        localSupported: false,
        reason: "No built-in passkey on this device. Scan the QR code to approve on your phone.",
        code: "PLATFORM_AUTHENTICATOR_UNAVAILABLE",
      };
    }

    return { localSupported: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logPasskeyEvent("error", {
      action: "detect_support",
      reason: "detection_failed",
      userAgent: navigator.userAgent,
      details: { message },
    });
    return {
      localSupported: false,
      reason: "Could not detect passkey support on this device.",
      code: "DETECTION_FAILED",
    };
  }
}
