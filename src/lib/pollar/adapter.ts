import {
  FAKE_POLLAR_STAFF_WALLET,
  PollarTokenVerifyError,
  type PollarTokenVerifier,
  type PollarVerifiedIdentity,
} from "./types";

/** Current Pollar Server API. `https://api.pollar.xyz` is dead (404). */
export const POLLAR_SERVER_API_ORIGIN = "https://server.api.pollar.xyz";

const LEGACY_DEAD_SERVER_HOSTS = new Set(["api.pollar.xyz"]);

/**
 * Origin for secret-key Server API calls. Rewrites the retired api.pollar.xyz
 * host and strips a trailing /v1 or /v3 so we always append `/v3/...`.
 */
export function resolvePollarServerBase(raw?: string | null): string {
  const fallback = POLLAR_SERVER_API_ORIGIN;
  const trimmed = (raw ?? "").trim();
  const value = (trimmed || fallback).replace(/\/+$/, "").replace(/\/v\d+$/i, "");
  try {
    const url = new URL(value);
    if (LEGACY_DEAD_SERVER_HOSTS.has(url.hostname)) return fallback;
    const path = url.pathname === "/" ? "" : url.pathname.replace(/\/+$/, "");
    return `${url.origin}${path}`;
  } catch {
    return fallback;
  }
}

export function pollarTokenVerifyUrl(raw?: string | null): string {
  return `${resolvePollarServerBase(raw)}/v3/tokens/verify`;
}

/**
 * Fake verifier for tests / local `POLLAR_FAKE_AUTH=true`.
 * Token format: `fake.<subject>.<email>` (email may use `_at_` for `@`).
 */
export class FakePollarTokenVerifier implements PollarTokenVerifier {
  async verify(token: string): Promise<PollarVerifiedIdentity> {
    if (!token.startsWith("fake.")) {
      throw new PollarTokenVerifyError("Invalid fake token", "POLLAR_FAKE_TOKEN_INVALID");
    }
    const rest = token.slice("fake.".length);
    const dot = rest.indexOf(".");
    if (dot <= 0 || dot === rest.length - 1) {
      throw new PollarTokenVerifyError("Invalid fake token shape", "POLLAR_FAKE_TOKEN_INVALID");
    }
    const subject = rest.slice(0, dot);
    const emailRaw = rest.slice(dot + 1);
    const email = emailRaw.includes("@") ? emailRaw : emailRaw.replace(/_at_/g, "@");
    if (!subject || !email.includes("@")) {
      throw new PollarTokenVerifyError("Invalid fake identity", "POLLAR_FAKE_TOKEN_INVALID");
    }
    return {
      subject,
      email,
      authProvider: "google",
      walletAddress: FAKE_POLLAR_STAFF_WALLET,
    };
  }
}

/**
 * Live Pollar Server API token verify (`POST /v3/tokens/verify`).
 * Docs: https://docs.pollar.xyz/docs/sdk-reference/server-api
 */
export class HttpPollarTokenVerifier implements PollarTokenVerifier {
  private readonly verifyUrl: string;

  constructor(
    private readonly secretKey: string,
    baseUrl: string | null | undefined = process.env.POLLAR_SERVER_BASE,
  ) {
    this.verifyUrl = pollarTokenVerifyUrl(baseUrl);
  }

  async verify(token: string): Promise<PollarVerifiedIdentity> {
    const url = this.verifyUrl;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-pollar-api-key": this.secretKey,
      },
      body: JSON.stringify({ token }),
    });
    const body = (await res.json().catch(() => ({}))) as {
      success?: boolean;
      code?: string;
      content?: {
        userId?: string;
        profile?: { email?: string };
        wallet?: { address?: string; publicKey?: string };
        authProvider?: string;
      };
    };
    if (!res.ok || !body.success) {
      throw new PollarTokenVerifyError(
        body.code ?? `Pollar verify failed (${res.status})`,
        body.code ?? "POLLAR_TOKEN_VERIFY_FAILED",
      );
    }
    const subject = body.content?.userId;
    const email = body.content?.profile?.email;
    if (!subject || !email) {
      throw new PollarTokenVerifyError(
        "Pollar verify response missing userId/email",
        "POLLAR_TOKEN_VERIFY_INCOMPLETE",
      );
    }
    return {
      subject,
      email,
      walletAddress:
        body.content?.wallet?.address ?? body.content?.wallet?.publicKey ?? null,
      authProvider: body.content?.authProvider ?? null,
    };
  }
}

export function createPollarTokenVerifier(): PollarTokenVerifier {
  if (
    process.env.POLLAR_FAKE_AUTH === "true" ||
    process.env.NODE_ENV === "test"
  ) {
    return new FakePollarTokenVerifier();
  }
  const secret = (process.env.POLLAR_SECRET_KEY ?? "").trim();
  if (!secret) {
    if (process.env.NODE_ENV !== "production") {
      return new FakePollarTokenVerifier();
    }
    throw new Error("POLLAR_SECRET_KEY is required to verify Pollar tokens");
  }
  return new HttpPollarTokenVerifier(secret);
}
