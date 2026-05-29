const SECP256R1_PUBLIC_KEY_SIZE = 65;

/** Base64url-encode a 65-byte secp256r1 public key for server registration. */
export function publicKeyToBase64Url(publicKey: Uint8Array): string {
  const b64 =
    typeof Buffer !== "undefined"
      ? Buffer.from(publicKey).toString("base64")
      : btoa(String.fromCharCode(...publicKey));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

/** Decode a base64url credential id to bytes (server-safe). */
export function credentialIdToBuffer(credentialId: string): Buffer {
  const padded = credentialId.replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
  return Buffer.from(padded + pad, "base64");
}

/** Extract credential id bytes from OZ smart-account key_data (pubkey + credentialId). */
export function extractCredentialIdFromKeyData(keyData: Uint8Array): Uint8Array {
  return keyData.slice(SECP256R1_PUBLIC_KEY_SIZE);
}

/** Extract 65-byte public key from OZ smart-account key_data. */
export function extractPublicKeyFromKeyData(keyData: Uint8Array): Uint8Array {
  return keyData.slice(0, SECP256R1_PUBLIC_KEY_SIZE);
}
