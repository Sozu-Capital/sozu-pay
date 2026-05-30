"use client";

import { base64URLToBuffer, bufferToBase64URL } from "@/lib/webauthn/utils";

export type PasskeyChallenge = {
  challenge: string;
  rpId: string;
  rp?: { name: string; id: string };
  user?: { id: string; name: string; displayName: string };
  allowCredentials?: Array<{
    id: string;
    type: string;
    transports?: AuthenticatorTransport[];
  }>;
  authenticatorSelection?: PublicKeyCredentialCreationOptions["authenticatorSelection"];
  timeout?: number;
  userVerification?: UserVerificationRequirement;
};

export type PasskeyCredential = {
  id: string;
  rawId: string;
  type: string;
  response: {
    clientDataJSON: string;
    authenticatorData?: string;
    signature?: string;
    attestationObject?: string;
    userHandle?: string | null;
    transports?: AuthenticatorTransport[];
  };
};

function arrayBufferToBase64URL(buffer: ArrayBuffer): string {
  return bufferToBase64URL(buffer);
}

function base64URLToArrayBuffer(base64url: string): ArrayBuffer {
  return base64URLToBuffer(base64url);
}

export async function fetchRegisterChallenge(username: string): Promise<PasskeyChallenge> {
  const res = await fetch("/api/auth/register/challenge", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error ?? "Failed to start registration");
    (err as Error & { usernameExists?: boolean }).usernameExists = data.usernameExists;
    throw err;
  }
  return {
    challenge: data.challenge,
    rpId: data.rp.id,
    rp: data.rp,
    user: data.user,
    timeout: data.timeout,
    authenticatorSelection: data.authenticatorSelection,
  };
}

export async function fetchLoginChallenge(username?: string): Promise<PasskeyChallenge> {
  const res = await fetch("/api/auth/login/challenge", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(username ? { username } : {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Failed to start login");
  const rpId =
    data.rp?.id ?? (typeof window !== "undefined" ? window.location.hostname : "localhost");
  return {
    challenge: data.challenge,
    rpId,
    allowCredentials: data.allowCredentials,
    timeout: data.timeout,
    userVerification: data.userVerification,
  };
}

export async function createPasskey(challenge: PasskeyChallenge): Promise<PasskeyCredential> {
  if (!window.PublicKeyCredential) {
    throw new Error("WebAuthn is not supported in this browser");
  }
  const userHandleBytes = new TextEncoder().encode(challenge.user?.id ?? "user");
  const credential = (await navigator.credentials.create({
    publicKey: {
      challenge: base64URLToArrayBuffer(challenge.challenge),
      rp: challenge.rp ?? { name: "SozuPay", id: challenge.rpId },
      user: {
        id: userHandleBytes,
        name: challenge.user?.name ?? "user",
        displayName: challenge.user?.displayName ?? challenge.user?.name ?? "User",
      },
      pubKeyCredParams: [
        { alg: -7, type: "public-key" },
        { alg: -257, type: "public-key" },
      ],
      authenticatorSelection: {
        requireResidentKey: true,
        residentKey: "required",
        userVerification: "required",
        ...challenge.authenticatorSelection,
      },
      timeout: challenge.timeout ?? 60000,
    },
  })) as PublicKeyCredential | null;

  if (!credential) throw new Error("Passkey creation was cancelled");

  const response = credential.response as AuthenticatorAttestationResponse;
  const transports =
    typeof response.getTransports === "function" ? response.getTransports() : [];

  return {
    id: credential.id,
    rawId: arrayBufferToBase64URL(credential.rawId),
    type: credential.type,
    response: {
      clientDataJSON: arrayBufferToBase64URL(response.clientDataJSON),
      attestationObject: arrayBufferToBase64URL(response.attestationObject),
      ...(transports.length ? { transports: transports as AuthenticatorTransport[] } : {}),
    },
  };
}

export async function getPasskey(challenge: PasskeyChallenge): Promise<PasskeyCredential> {
  if (!window.PublicKeyCredential) {
    throw new Error("WebAuthn is not supported in this browser");
  }
  const credential = (await navigator.credentials.get({
    publicKey: {
      challenge: base64URLToArrayBuffer(challenge.challenge),
      rpId: challenge.rpId,
      allowCredentials: challenge.allowCredentials?.map((cred) => ({
        id: base64URLToArrayBuffer(cred.id),
        type: cred.type as PublicKeyCredentialType,
        ...(cred.transports?.length ? { transports: cred.transports } : {}),
      })),
      timeout: challenge.timeout ?? 60000,
      userVerification: challenge.userVerification ?? "required",
    },
  })) as PublicKeyCredential | null;

  if (!credential) throw new Error("Passkey sign-in was cancelled");

  const response = credential.response as AuthenticatorAssertionResponse;
  return {
    id: credential.id,
    rawId: arrayBufferToBase64URL(credential.rawId),
    type: credential.type,
    response: {
      clientDataJSON: arrayBufferToBase64URL(response.clientDataJSON),
      authenticatorData: arrayBufferToBase64URL(response.authenticatorData),
      signature: arrayBufferToBase64URL(response.signature),
      userHandle: response.userHandle
        ? new TextDecoder().decode(response.userHandle)
        : null,
    },
  };
}

export async function verifyRegistration(params: {
  username: string;
  credential: PasskeyCredential;
  challenge: string;
  returnTo?: string;
}): Promise<{ redirect: string }> {
  const res = await fetch("/api/auth/register/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      username: params.username,
      credential: params.credential,
      challenge: params.challenge,
      returnTo: params.returnTo,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Registration failed");
  return { redirect: data.redirect ?? "/onboarding/setup-smart-wallet" };
}

export async function verifyLogin(params: {
  username?: string;
  credential: PasskeyCredential;
  challenge: string;
  returnTo?: string;
}): Promise<{ redirect: string }> {
  const res = await fetch("/api/auth/login/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      username: params.username ?? "",
      credential: params.credential,
      challenge: params.challenge,
      returnTo: params.returnTo,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Login failed");
  return { redirect: data.redirect ?? "/dashboard" };
}

export async function loginWithPin(params: {
  username: string;
  pin: string;
  returnTo?: string;
}): Promise<{ redirect: string }> {
  const res = await fetch("/api/auth/pin/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(params),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (data.error === "pin_not_configured") {
      throw new Error(data.message ?? "No backup PIN on this account.");
    }
    throw new Error(data.error ?? "PIN login failed");
  }
  return { redirect: data.redirect ?? "/dashboard" };
}
