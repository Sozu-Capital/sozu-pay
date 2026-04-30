/**
 * Client-side crypto for org disbursement wallet (user-derived encryption).
 * Used in the browser only: encrypt at org creation, decrypt when signing a payout.
 * Uses Web Crypto: PBKDF2-SHA256 for key derivation, AES-GCM for encryption.
 * Do not import from server code.
 */

const ALGO_KDF = "PBKDF2";
const ALGO_ENC = "AES-GCM";
const IV_LEN = 12;
const AUTH_TAG_LEN = 16;
const KEY_LEN = 256;
const DEFAULT_ITERATIONS = 120000;

export type EncryptedBlob = {
  v: 1;
  salt: string;
  iv: string;
  /** Ciphertext (encrypted data + GCM auth tag, as returned by Web Crypto encrypt) */
  ciphertext: string;
  iterations: number;
};

function b64urlEncode(data: ArrayBuffer | Uint8Array): string {
  const u8 = data instanceof Uint8Array ? data : new Uint8Array(data);
  let binary = "";
  for (let i = 0; i < u8.length; i++) binary += String.fromCharCode(u8[i]!);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function b64urlDecode(str: string): Uint8Array {
  const pad = str.length % 4 === 0 ? 0 : 4 - (str.length % 4);
  const base64 = (str + "=".repeat(pad)).replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function deriveKey(
  passphrase: string,
  salt: Uint8Array,
  iterations: number
): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(passphrase),
    "PBKDF2",
    false,
    ["deriveBits", "deriveKey"]
  );
  return crypto.subtle.deriveKey(
    {
      name: ALGO_KDF,
      salt: salt as BufferSource,
      iterations,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: ALGO_ENC, length: KEY_LEN },
    false,
    ["encrypt", "decrypt"]
  );
}

/**
 * Encrypt a Stellar secret key with the payout password.
 * Returns a JSON-serializable object (store as string in DB).
 */
export async function encryptOrgSecretClient(
  secretKey: string,
  passphrase: string,
  iterations: number = DEFAULT_ITERATIONS
): Promise<EncryptedBlob> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(IV_LEN));
  const key = await deriveKey(passphrase, salt, iterations);

  const enc = new TextEncoder();
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: ALGO_ENC,
      iv: iv as BufferSource,
      tagLength: AUTH_TAG_LEN * 8,
    },
    key,
    enc.encode(secretKey)
  );

  return {
    v: 1,
    salt: b64urlEncode(salt),
    iv: b64urlEncode(iv),
    ciphertext: b64urlEncode(ciphertext),
    iterations,
  };
}

/**
 * Decrypt the stored blob with the payout password.
 * Returns the Stellar secret key (use only in memory, then discard).
 */
export async function decryptOrgSecretClient(
  blob: EncryptedBlob | string,
  passphrase: string
): Promise<string> {
  const b = typeof blob === "string" ? (JSON.parse(blob) as EncryptedBlob) : blob;
  if (b.v !== 1) {
    throw new Error("Unsupported encrypted blob version");
  }

  const salt = b64urlDecode(b.salt);
  const iv = b64urlDecode(b.iv);
  const ciphertext = b64urlDecode(b.ciphertext);

  const key = await deriveKey(passphrase, salt, b.iterations);

  const dec = await crypto.subtle.decrypt(
    {
      name: ALGO_ENC,
      iv: iv as BufferSource,
      tagLength: AUTH_TAG_LEN * 8,
    },
    key,
    ciphertext as BufferSource
  );

  return new TextDecoder().decode(dec);
}
