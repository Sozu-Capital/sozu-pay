"use client";

import { startAuthentication } from "@simplewebauthn/browser";
import base64url from "base64url";
import { Address, hash, rpc, xdr } from "@stellar/stellar-sdk";
import {
  extractPublicKeyFromKeyData,
  parsePasskeyPublicKey65,
} from "@/lib/stellar/smartAccounts/passkeyPublicKey";
import {
  buildOzAuthPayloadScVal,
  defaultContextRuleIdsForEntry,
  ozWebAuthnChallengeFromEntry,
} from "@/lib/stellar/smartAccounts/ozAuthPayload";
import { normalizeCredentialId } from "@/lib/webauthn/utils";

const WEBAUTHN_TIMEOUT_MS = 45_000;
const SECP256R1_PUBLIC_KEY_SIZE = 65;
const AUTH_DATA_FLAGS_UP = 0x01;
const AUTH_DATA_FLAGS_UV = 0x04;
const AUTH_DATA_FLAGS_BE = 0x08;
const AUTH_DATA_FLAGS_BS = 0x10;
const AUTH_EXPIRATION_LEDGER_BUFFER = 12;
const AUTH_EXPIRATION_LEDGER_TTL = 60;

async function resolveSignatureExpirationLedger(
  preferred: number | undefined,
  credentials: ReturnType<xdr.SorobanAuthorizationEntry["credentials"]>
): Promise<number> {
  const rpcUrl =
    process.env.NEXT_PUBLIC_SOROBAN_RPC_URL?.trim() || "https://soroban-testnet.stellar.org";
  const server = new rpc.Server(rpcUrl, { allowHttp: rpcUrl.startsWith("http://") });
  const latest = await server.getLatestLedger();
  const ledger = latest.sequence;
  const minValid = ledger + AUTH_EXPIRATION_LEDGER_BUFFER;

  let expiration = preferred;
  if (expiration == null || expiration <= 0) {
    const fromEntry = credentials.address().signatureExpirationLedger();
    const entryExp = fromEntry != null ? Number(fromEntry) : 0;
    expiration = entryExp > 0 ? entryExp : ledger + AUTH_EXPIRATION_LEDGER_TTL;
  }
  if (expiration < minValid) {
    expiration = ledger + AUTH_EXPIRATION_LEDGER_TTL;
  }
  return expiration;
}

function lowSCompactSignature(compact: Buffer): Uint8Array {
  const s = compact.subarray(32, 64);
  let sBigInt = BigInt(`0x${s.toString("hex")}`);
  const n = BigInt("0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551");
  const halfN = n / BigInt(2);
  if (sBigInt > halfN) {
    sBigInt = n - sBigInt;
  }
  const sLowS = Buffer.from(sBigInt.toString(16).padStart(64, "0"), "hex");
  return new Uint8Array(Buffer.concat([compact.subarray(0, 32), sLowS]));
}

function compactSignature(derSignature: Buffer): Uint8Array {
  let offset = 2;
  const rLength = derSignature[offset + 1];
  const r = derSignature.slice(offset + 2, offset + 2 + rLength);
  offset += 2 + rLength;
  const sLength = derSignature[offset + 1];
  const s = derSignature.slice(offset + 2, offset + 2 + sLength);
  const rBigInt = BigInt(`0x${r.toString("hex")}`);
  let sBigInt = BigInt(`0x${s.toString("hex")}`);
  const n = BigInt("0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551");
  const halfN = n / BigInt(2);
  if (sBigInt > halfN) {
    sBigInt = n - sBigInt;
  }
  const rPadded = Buffer.from(rBigInt.toString(16).padStart(64, "0"), "hex");
  const sLowS = Buffer.from(sBigInt.toString(16).padStart(64, "0"), "hex");
  return new Uint8Array(Buffer.concat([rPadded, sLowS]));
}

function toStellarCompactSignature(derOrRaw: Buffer): Uint8Array {
  if (derOrRaw.length === 64) {
    return lowSCompactSignature(derOrRaw);
  }
  if (derOrRaw[0] === 0x30) {
    return compactSignature(derOrRaw);
  }
  throw new Error(
    `Unexpected WebAuthn signature (${derOrRaw.length} bytes). Retry the passkey prompt.`
  );
}

function buildSignatureMapEntry(
  webauthnVerifierAddress: string,
  keyData: Buffer,
  sigData: {
    authenticator_data: Buffer;
    client_data: Buffer;
    signature: Uint8Array;
  }
): xdr.ScMapEntry {
  const keyVal = xdr.ScVal.scvVec([
    xdr.ScVal.scvSymbol("External"),
    xdr.ScVal.scvAddress(Address.fromString(webauthnVerifierAddress).toScAddress()),
    xdr.ScVal.scvBytes(keyData),
  ]);
  const sigDataScVal = xdr.ScVal.scvMap([
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol("authenticator_data"),
      val: xdr.ScVal.scvBytes(sigData.authenticator_data),
    }),
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol("client_data"),
      val: xdr.ScVal.scvBytes(sigData.client_data),
    }),
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol("signature"),
      val: xdr.ScVal.scvBytes(Buffer.from(sigData.signature)),
    }),
  ]);
  return new xdr.ScMapEntry({
    key: keyVal,
    val: xdr.ScVal.scvBytes(sigDataScVal.toXDR()),
  });
}

function sortSignerMapEntries(sigMap: xdr.ScMapEntry[]): void {
  if (sigMap.length <= 1) return;
  sigMap.sort((a, b) => {
    const aKeyXdr = a.key().toXDR("hex");
    const bKeyXdr = b.key().toXDR("hex");
    return aKeyXdr.localeCompare(bKeyXdr);
  });
}

function applyOzAuthPayloadSignature(
  credentials: xdr.SorobanAddressCredentials,
  scMapEntry: xdr.ScMapEntry,
  contextRuleIds: number[]
): void {
  const currentSig = credentials.signature();
  if (currentSig.switch().name === "scvMap") {
    const payloadMap = currentSig.map() ?? [];
    let signersMap: xdr.ScMapEntry[] | null = null;
    for (const entry of payloadMap) {
      if (entry.key().switch().name === "scvSymbol" && entry.key().sym().toString() === "signers") {
        signersMap = entry.val().map() ?? [];
        break;
      }
    }
    if (signersMap) {
      signersMap.push(scMapEntry);
      sortSignerMapEntries(signersMap);
      return;
    }
  }
  credentials.signature(buildOzAuthPayloadScVal([scMapEntry], contextRuleIds));
}

function assertKeyDataMatchesStoredPasskey(keyData: Buffer, storedPublicKey65: Uint8Array): void {
  const onChain = extractPublicKeyFromKeyData(keyData);
  if (Buffer.from(onChain).equals(Buffer.from(storedPublicKey65))) return;
  throw new Error(
    "Database and on-chain public keys disagree with this passkey's signing key. Sign out, register again at the same URL, and create a new smart wallet."
  );
}

async function resolveKeyDataFromChain(params: {
  contractId: string;
  credentialId: string;
  authEntry: xdr.SorobanAuthorizationEntry;
}): Promise<Buffer | null> {
  const q = new URLSearchParams({
    contractId: params.contractId,
    credentialId: params.credentialId,
    authEntryXdr: params.authEntry.toXDR("base64"),
  });
  const res = await fetch(`/api/smart-accounts/resolve-key-data?${q}`, { credentials: "include" });
  const data = (await res.json().catch(() => ({}))) as { keyDataBase64?: string };
  if (!res.ok || !data.keyDataBase64) return null;
  return Buffer.from(data.keyDataBase64, "base64");
}

async function loadPasskeyPublicKey65(credentialId: string): Promise<Uint8Array> {
  const res = await fetch("/api/auth/passkeys/primary", { credentials: "include" });
  const data = (await res.json().catch(() => ({}))) as {
    publicKey65b?: string;
    credentialId?: string;
    error?: string;
  };
  if (!res.ok || !data.publicKey65b) {
    throw new Error(
      data.error ??
        "Passkey public key missing. Open Profile and re-link your smart wallet, or sign in again."
    );
  }
  if (
    data.credentialId &&
    normalizeCredentialId(data.credentialId) !== normalizeCredentialId(credentialId)
  ) {
    throw new Error(
      "Login passkey does not match the credential used for signing. Sign out and sign in with the same passkey as your smart wallet."
    );
  }
  return parsePasskeyPublicKey65(data.publicKey65b);
}

async function webAuthnSignSorobanPreimage(
  challengeB64Url: string,
  credentialId: string
): Promise<{
  authenticator_data: Buffer;
  client_data: Buffer;
  signature: Uint8Array;
  credentialId: string;
  rpId: string;
}> {
  const rpId =
    (typeof window !== "undefined" ? window.location.hostname : undefined) ||
    process.env.NEXT_PUBLIC_RP_ID?.trim() ||
    "localhost";

  let authResponse: Awaited<ReturnType<typeof startAuthentication>>;
  try {
    authResponse = await startAuthentication({
      optionsJSON: {
        challenge: challengeB64Url,
        rpId,
        allowCredentials: [{ id: credentialId, type: "public-key" }],
        userVerification: "required",
        timeout: WEBAUTHN_TIMEOUT_MS,
      },
    });
  } catch (err) {
    const name = err instanceof Error ? err.name : "";
    if (name === "NotAllowedError" || name === "AbortError") {
      throw new Error(
        "Passkey prompt was cancelled or blocked. Close any other passkey dialog, then try again."
      );
    }
    if (name === "TimeoutError") {
      throw new Error("Passkey prompt timed out. Try again and complete Face ID / Touch ID when prompted.");
    }
    throw err;
  }

  const rawSignature = base64url.toBuffer(authResponse.response.signature);
  return {
    authenticator_data: base64url.toBuffer(authResponse.response.authenticatorData),
    client_data: base64url.toBuffer(authResponse.response.clientDataJSON),
    signature: toStellarCompactSignature(rawSignature),
    credentialId: authResponse.id,
    rpId,
  };
}

async function sha256Bytes(input: string): Promise<Buffer> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Buffer.from(digest);
}

async function assertWebAuthnPayloadMatchesExpected(params: {
  expectedChallenge: string;
  rpId: string;
  clientDataJson: Buffer;
  authenticatorData: Buffer;
}): Promise<void> {
  const clientDataRaw = params.clientDataJson.toString("utf8");
  let clientData: { challenge?: string; origin?: string; type?: string };
  try {
    clientData = JSON.parse(clientDataRaw);
  } catch {
    throw new Error("WebAuthn clientDataJSON could not be parsed.");
  }

  const actualChallenge = clientData.challenge ?? "";
  if (actualChallenge !== params.expectedChallenge) {
    throw new Error(
      "WebAuthn challenge mismatch. Please retry from the same tab and URL without refreshing during Touch ID."
    );
  }

  const origin = clientData.origin ?? "";
  if (typeof window !== "undefined" && origin && !origin.startsWith(window.location.origin)) {
    throw new Error(
      `WebAuthn origin mismatch: expected ${window.location.origin}, got ${origin}. Use one canonical URL and retry.`
    );
  }

  if (clientData.type !== "webauthn.get") {
    throw new Error(
      `WebAuthn type must be "webauthn.get" for Soroban auth (got "${clientData.type ?? ""}").`
    );
  }

  if (params.authenticatorData.length < 37) {
    throw new Error("WebAuthn authenticator_data is too short.");
  }
  const rpHashFromAuth = params.authenticatorData.subarray(0, 32);
  const expectedRpHash = await sha256Bytes(params.rpId);
  if (!Buffer.from(rpHashFromAuth).equals(expectedRpHash)) {
    throw new Error(
      `WebAuthn rpId hash mismatch. Expected rpId "${params.rpId}" for this URL, but assertion was produced for a different rpId.`
    );
  }

  const flags = params.authenticatorData[32]!;
  if ((flags & AUTH_DATA_FLAGS_UP) === 0) {
    throw new Error(
      "WebAuthn user presence (UP) was not set. Complete the passkey prompt (Touch ID / Face ID) and try again."
    );
  }
  if ((flags & AUTH_DATA_FLAGS_UV) === 0) {
    throw new Error(
      "WebAuthn user verification (UV) was not set. Your passkey must verify you (biometrics or device PIN)."
    );
  }
  if ((flags & AUTH_DATA_FLAGS_BE) === 0 && (flags & AUTH_DATA_FLAGS_BS) !== 0) {
    throw new Error(
      "WebAuthn backup state is invalid for this passkey. Try another passkey or sign out and register a new wallet."
    );
  }
}

/** Smart account C… address that must authorize this auth entry. */
export function smartAccountIdFromAuthEntry(entry: xdr.SorobanAuthorizationEntry): string {
  const creds = entry.credentials();
  if (creds.switch().name !== "sorobanCredentialsAddress") {
    throw new Error("Expected Soroban address credentials on auth entry.");
  }
  return Address.fromScAddress(creds.address().address()).toString().toUpperCase();
}

/**
 * Manual OZ passkey Soroban auth signing (avoids kit calling get_context_rules on payout contracts).
 */
export async function signAuthEntryWithResolvedKeyData(params: {
  entry: xdr.SorobanAuthorizationEntry;
  credentialId: string;
  networkPassphrase: string;
  webauthnVerifierAddress: string;
  smartAccountContractId: string;
  expiration?: number;
}): Promise<xdr.SorobanAuthorizationEntry> {
  const entryXdrBytes = params.entry.toXDR();
  const normalizedEntry = xdr.SorobanAuthorizationEntry.fromXDR(entryXdrBytes);
  const credentials = normalizedEntry.credentials().address();

  const entryExpiration = Number(credentials.signatureExpirationLedger());
  let expiration: number;
  if (entryExpiration > 0 && (!params.expiration || params.expiration <= 0)) {
    expiration = entryExpiration;
  } else if (params.expiration && params.expiration > 0) {
    expiration = params.expiration;
  } else {
    expiration = await resolveSignatureExpirationLedger(undefined, normalizedEntry.credentials());
  }
  credentials.signatureExpirationLedger(expiration);

  const contextRuleIds = defaultContextRuleIdsForEntry(normalizedEntry);
  const challenge = ozWebAuthnChallengeFromEntry({
    networkPassphrase: params.networkPassphrase,
    entry: normalizedEntry,
    contextRuleIds,
  });

  const webAuthnSig = await webAuthnSignSorobanPreimage(challenge, params.credentialId);
  await assertWebAuthnPayloadMatchesExpected({
    expectedChallenge: challenge,
    rpId: webAuthnSig.rpId,
    clientDataJson: webAuthnSig.client_data,
    authenticatorData: webAuthnSig.authenticator_data,
  });

  const contractId = params.smartAccountContractId.trim().toUpperCase();
  const [keyData, storedPubkey] = await Promise.all([
    resolveKeyDataFromChain({
      contractId,
      credentialId: webAuthnSig.credentialId,
      authEntry: normalizedEntry,
    }),
    loadPasskeyPublicKey65(params.credentialId),
  ]);
  if (!keyData) {
    throw new Error(
      `No signer found for this passkey on smart account ${contractId.slice(0, 8)}…. ` +
        "Ensure your passkey is registered on that smart account (member wallet or org treasury)."
    );
  }

  assertKeyDataMatchesStoredPasskey(keyData, storedPubkey);

  const { verifyWebAuthnAssertionForKeyData } = await import("@/lib/webauthn/verify-p256-assertion");
  const sigOk = await verifyWebAuthnAssertionForKeyData({
    keyData,
    authenticatorData: webAuthnSig.authenticator_data,
    clientData: webAuthnSig.client_data,
    signature64: webAuthnSig.signature,
  });
  if (!sigOk) {
    throw new Error(
      "This passkey signature does not match the public key on your smart account. Sign out, sign in with passkey, and retry."
    );
  }

  const scMapEntry = buildSignatureMapEntry(params.webauthnVerifierAddress, keyData, {
    authenticator_data: webAuthnSig.authenticator_data,
    client_data: webAuthnSig.client_data,
    signature: webAuthnSig.signature,
  });

  applyOzAuthPayloadSignature(credentials, scMapEntry, contextRuleIds);

  return normalizedEntry;
}
