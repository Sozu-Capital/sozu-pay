/**
 * Sign a Stellar transaction using Turnkey's signRawPayload (Ed25519).
 * Stellar signs the transaction hash (SHA-256). We send that hash to Turnkey,
 * get back a signature, then attach it to the envelope.
 * Stellar ED25519: 64-byte raw signature (R||S per RFC 8032); DecoratedSignature
 * uses a 4-byte hint = last 4 bytes of the signer's public key. We pass the signer
 * (signWithAddress) to addSignature so the SDK derives the hint from the signer.
 * See docs/04-integrations/turnkey-stellar-wallet-analysis.md
 */

import { Transaction } from "@stellar/stellar-sdk";

/** Normalize hex string: strip 0x, ensure even length for byte alignment. */
function normalizeHex(hex: string): string {
  const stripped = hex.startsWith("0x") ? hex.slice(2) : hex;
  return stripped.length % 2 === 0 ? stripped : "0" + stripped;
}

/** Ensure buffer is exactly size bytes; pad with leading zeros if shorter. */
function toSize(buf: Buffer, size: number): Buffer {
  if (buf.length >= size) return buf.subarray(0, size);
  const out = Buffer.alloc(size);
  buf.copy(out, size - buf.length);
  return out;
}

export type SignStellarTxWithTurnkeyParams = {
  /** Unsigned envelope XDR (base64). */
  envelopeXdr: string;
  networkPassphrase: string;
  /** Stellar account address (G...) that will sign - must be the Turnkey wallet account address. */
  signWithAddress: string;
  /** Turnkey httpClient.signRawPayload - called with (params, StamperType.Passkey). */
  signRawPayload: (
    params: {
      signWith: string;
      payload: string;
      encoding: "PAYLOAD_ENCODING_HEXADECIMAL";
      hashFunction: "HASH_FUNCTION_NO_OP";
    },
    stamper: "StamperType.Passkey"
  ) => Promise<{ r?: string; s?: string; v?: string; signature?: string }>;
};

/**
 * Returns signed envelope XDR (base64).
 * Throws if signing or envelope build fails.
 */
export async function signStellarTransactionWithTurnkey(
  params: SignStellarTxWithTurnkeyParams
): Promise<string> {
  const { envelopeXdr, networkPassphrase, signWithAddress, signRawPayload } = params;

  const tx = new Transaction(envelopeXdr, networkPassphrase);
  const hash = tx.hash();
  const hashHex = hash.toString("hex");

  const result = await signRawPayload(
    {
      signWith: signWithAddress,
      payload: hashHex,
      encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
      hashFunction: "HASH_FUNCTION_NO_OP",
    },
    "StamperType.Passkey"
  );

  // Turnkey Ed25519: result may be { signature } (hex) or { r, s } (hex).
  // Stellar expects 64-byte raw Ed25519 (R||S). addSignature(signerPublicKey, ...) derives
  // the DecoratedSignature hint from the signer's public key (last 4 bytes).
  let rawSig: Buffer;
  if (typeof (result as { signature?: string }).signature === "string") {
    const sigHex = normalizeHex((result as { signature: string }).signature);
    const sigBuf = Buffer.from(sigHex, "hex");
    rawSig = toSize(sigBuf, 64);
  } else if (
    typeof (result as { r?: string }).r === "string" &&
    typeof (result as { s?: string }).s === "string"
  ) {
    const rHex = normalizeHex((result as { r: string }).r);
    const sHex = normalizeHex((result as { s: string }).s);
    const r = Buffer.from(rHex, "hex");
    const s = Buffer.from(sHex, "hex");
    // Ed25519 is R (32 bytes) || S (32 bytes). Normalize to 32 each (pad or trim).
    rawSig = Buffer.concat([toSize(r, 32), toSize(s, 32)]);
  } else {
    throw new Error("Turnkey signRawPayload returned an unexpected signature format");
  }

  if (rawSig.length !== 64) {
    throw new Error(`Expected 64-byte Ed25519 signature, got ${rawSig.length}`);
  }

  // Hint is derived from signWithAddress (the signer) by the SDK, not from tx source.
  tx.addSignature(signWithAddress, rawSig.toString("base64"));
  return tx.toEnvelope().toXDR("base64");
}
