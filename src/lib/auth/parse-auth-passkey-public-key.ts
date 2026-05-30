import "server-only";

import { extractPublicKey65FromRegistration } from "@/lib/webauthn/extractPublicKey65";
import { publicKeyToBase64Url } from "@/lib/stellar/smartAccounts/passkeyPublicKey";

const UNCOMPRESSED_PREFIX = 0x04;
const KEY_SIZE = 65;

function decodeBase64Flexible(raw: string): Buffer {
  const padded = raw.replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
  return Buffer.from(padded + pad, "base64");
}

/**
 * Parse 65-byte secp256r1 public key from auth_passkeys.public_key (various legacy shapes).
 */
export function parseAuthPasskeyPublicKey65(stored: string | null | undefined): string | null {
  const raw = stored?.trim();
  if (!raw) return null;

  try {
    const decoded = decodeBase64Flexible(raw);
    if (decoded.length === KEY_SIZE && decoded[0] === UNCOMPRESSED_PREFIX) {
      return publicKeyToBase64Url(new Uint8Array(decoded));
    }
    if (decoded.length > KEY_SIZE) {
      const tail = decoded.subarray(decoded.length - KEY_SIZE);
      if (tail[0] === UNCOMPRESSED_PREFIX) {
        return publicKeyToBase64Url(new Uint8Array(tail));
      }
    }
  } catch {
    // not raw key bytes
  }

  try {
    return extractPublicKey65FromRegistration({ publicKey: raw });
  } catch {
    // continue
  }

  try {
    return extractPublicKey65FromRegistration({ attestationObject: raw });
  } catch {
    return null;
  }
}
