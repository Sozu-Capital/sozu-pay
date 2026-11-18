"use client";

import { RECEIVE_ACCOUNT_PRF_LABEL, openStellarSecret } from "@/lib/stellar/passkey-export";

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

async function prfSalt(): Promise<ArrayBuffer> {
  return crypto.subtle.digest("SHA-256", new TextEncoder().encode(RECEIVE_ACCOUNT_PRF_LABEL));
}

/** One passkey confirmation. Returns the PRF output, base64-encoded, and never stores it. */
export async function readPasskeyPrf(): Promise<string> {
  if (!window.PublicKeyCredential) {
    throw new Error("This browser cannot use a passkey.");
  }
  const credential = (await navigator.credentials.get({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rpId: process.env.NEXT_PUBLIC_RP_ID || window.location.hostname,
      userVerification: "required",
      timeout: 60000,
      extensions: {
        prf: { eval: { first: await prfSalt() } },
      } as AuthenticationExtensionsClientInputs,
    },
  })) as PublicKeyCredential | null;
  if (!credential) throw new Error("Passkey confirmation was cancelled.");
  const results = credential.getClientExtensionResults() as {
    prf?: { results?: { first?: ArrayBuffer } };
  };
  const first = results.prf?.results?.first;
  if (!first) {
    throw new Error("This passkey cannot unlock the store account. Use the same device passkey that runs this store.");
  }
  return bytesToBase64(new Uint8Array(first));
}

export function mainnetReceiveAccountEnabled(): boolean {
  return process.env.NEXT_PUBLIC_STELLAR_NETWORK === "public";
}

/** Fund the store account, open USDC, and seal the secret to the passkey. */
export async function ensureReceiveAccount(): Promise<{ publicKey: string; alreadyReady: boolean }> {
  const prf = await readPasskeyPrf();
  const res = await fetch("/api/profile/org/receive-account", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prf }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    error?: string;
    publicKey?: string;
    alreadyReady?: boolean;
  };
  if (!res.ok || !data.publicKey) {
    throw new Error(data.error ?? "Could not finish the receiving account.");
  }
  return { publicKey: data.publicKey, alreadyReady: Boolean(data.alreadyReady) };
}

/** Decrypt the store secret on this device. Nothing is sent back to the server. */
export async function exportReceiveAccount(): Promise<string> {
  const prf = await readPasskeyPrf();
  const res = await fetch("/api/profile/org/receive-account", { credentials: "include" });
  const data = (await res.json().catch(() => ({}))) as { error?: string; blob?: string };
  if (!res.ok || !data.blob) {
    throw new Error(data.error ?? "No export is saved for this store.");
  }
  return openStellarSecret(data.blob, base64ToBytes(prf));
}
