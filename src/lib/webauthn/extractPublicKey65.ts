import { base64URLToBuffer } from "@/lib/webauthn/utils";
import { publicKeyToBase64Url } from "@/lib/stellar/smartAccounts/passkeyPublicKey";

const UNCOMPRESSED_PREFIX = 0x04;
const KEY_SIZE = 65;

/** Extract 65-byte secp256r1 public key from WebAuthn registration response (client). */
export function extractPublicKey65FromRegistration(response: {
  publicKey?: string;
  authenticatorData?: string;
  attestationObject?: string;
}): string {
  let publicKey: Uint8Array | undefined;

  if (response.publicKey) {
    const buf = new Uint8Array(base64URLToBuffer(response.publicKey));
    publicKey = buf.slice(buf.length - KEY_SIZE);
  }

  if (
    !publicKey ||
    publicKey[0] !== UNCOMPRESSED_PREFIX ||
    publicKey.length !== KEY_SIZE
  ) {
    let x: Uint8Array | undefined;
    let y: Uint8Array | undefined;

    if (response.authenticatorData) {
      const authenticatorData = new Uint8Array(base64URLToBuffer(response.authenticatorData));
      const credentialIdLength = (authenticatorData[53]! << 8) | authenticatorData[54]!;
      x = authenticatorData.slice(65 + credentialIdLength, 97 + credentialIdLength);
      y = authenticatorData.slice(97 + credentialIdLength, 129 + credentialIdLength);
    } else if (response.attestationObject) {
      const attestationObject = new Uint8Array(base64URLToBuffer(response.attestationObject));
      const prefix = new Uint8Array([
        0xa5, 0x01, 0x02, 0x03, 0x26, 0x20, 0x01, 0x21, 0x58, 0x20,
      ]);
      let start = -1;
      for (let i = 0; i <= attestationObject.length - prefix.length; i++) {
        if (prefix.every((b, j) => attestationObject[i + j] === b)) {
          start = i + prefix.length;
          break;
        }
      }
      if (start < 0) throw new Error("Could not extract passkey public key");
      x = attestationObject.slice(start, start + 32);
      y = attestationObject.slice(start + 35, start + 67);
    } else {
      throw new Error("Could not extract passkey public key");
    }

    const combined = new Uint8Array(KEY_SIZE);
    combined[0] = UNCOMPRESSED_PREFIX;
    combined.set(x, 1);
    combined.set(y, 33);
    publicKey = combined;
  }

  return publicKeyToBase64Url(publicKey);
}
