/**
 * Stellar account secrets sealed with a WebAuthn PRF output.
 * The server stores only this blob. It cannot decrypt it.
 */

export const RECEIVE_ACCOUNT_PRF_LABEL = "sozu-receive-account-v1";

export type PasskeyExportBlob = {
  v: 1;
  iv: string;
  ct: string;
};

/** A fresh ArrayBuffer view. WebCrypto rejects a view over ArrayBufferLike. */
function exactBytes(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  const copy = new Uint8Array(new ArrayBuffer(bytes.byteLength));
  copy.set(bytes);
  return copy;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function isPasskeyExportBlob(value: unknown): value is PasskeyExportBlob {
  if (!value || typeof value !== "object") return false;
  const blob = value as PasskeyExportBlob;
  return blob.v === 1 && typeof blob.iv === "string" && typeof blob.ct === "string";
}

async function aesKey(prf: Uint8Array): Promise<CryptoKey> {
  if (prf.byteLength < 32) {
    throw new Error("Passkey key is too short.");
  }
  const raw = exactBytes(prf.subarray(0, 32));
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function sealStellarSecret(secret: string, prf: Uint8Array): Promise<string> {
  const key = await aesKey(prf);
  const iv = exactBytes(crypto.getRandomValues(new Uint8Array(12)));
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      exactBytes(new TextEncoder().encode(secret)),
    ),
  );
  return JSON.stringify({
    v: 1,
    iv: bytesToBase64(iv),
    ct: bytesToBase64(ciphertext),
  } satisfies PasskeyExportBlob);
}

export async function openStellarSecret(blobText: string, prf: Uint8Array): Promise<string> {
  const parsed = JSON.parse(blobText) as unknown;
  if (!isPasskeyExportBlob(parsed)) {
    throw new Error("Export blob is not a passkey-sealed account.");
  }
  const key = await aesKey(prf);
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: exactBytes(base64ToBytes(parsed.iv)) },
    key,
    exactBytes(base64ToBytes(parsed.ct)),
  );
  return new TextDecoder().decode(plain);
}
