"use client";

import { isValidSession, WebCryptoKeyManager } from "@pollar/core";
import {
  pollarLoginTimeoutMs,
  pollarSdkApiPath,
  pollarStellarNetworkForClient,
} from "@/lib/pollar/network";
import {
  accessTokenFromLoginResponse,
  hashApiKeyPrefix,
  pollarSessionStorageKey,
} from "@/lib/pollar/oauth-resume";

const POLLAR_SDK_BASE =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_POLLAR_SDK_BASE?.replace(/\/$/, "")) ||
  "https://sdk.api.pollar.xyz";

const POLL_INTERVAL_MS = 500;
export const POLL_TIMEOUT_MS = 5 * 60 * 1000;

export type PollarSessionPollResult = "ready" | "consumed" | "dead" | "timeout";

type StatusBody = {
  success?: boolean;
  code?: string;
  content?: { status?: string };
} | null;

export function isPollarSessionReady(status: string | null | undefined): boolean {
  return status === "READY";
}

export function isPollarSessionConsumed(status: string | null | undefined): boolean {
  return status === "CONSUMED";
}

export function isPollarSessionDead(
  httpStatus: number,
  code?: string | null,
): boolean {
  return (
    httpStatus === 404 ||
    httpStatus === 410 ||
    code === "INVALID_CLIENT_SESSION_ID" ||
    code === "EXPIRED_CLIENT_ID" ||
    code === "SDK_UPGRADE_REQUIRED"
  );
}

export function isPollarSessionFailed(status: string | null | undefined): boolean {
  return status === "FAILED" || status === "ERROR";
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) {
      resolve();
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });
}

export async function waitForPollarSessionReady(
  clientSessionId: string,
  timeoutMs: number = POLL_TIMEOUT_MS,
  signal?: AbortSignal,
): Promise<PollarSessionPollResult> {
  const url = `${POLLAR_SDK_BASE}${pollarSdkApiPath(`/auth/session/status/${encodeURIComponent(clientSessionId)}/poll`)}`;
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (signal?.aborted) return "timeout";
    try {
      const res = await fetch(url, { headers: { accept: "application/json" }, signal });
      const body = (await res.json().catch(() => null)) as StatusBody;
      if (isPollarSessionDead(res.status, body?.code)) return "dead";
      const status = body?.content?.status;
      if (isPollarSessionFailed(status)) return "dead";
      if (isPollarSessionReady(status)) return "ready";
      if (isPollarSessionConsumed(status)) return "consumed";
      // GENERATING_WALLET / PENDING: keep polling — wallet create can take a minute.
    } catch (err) {
      if (signal?.aborted || (err instanceof Error && err.name === "AbortError")) {
        return "timeout";
      }
      // retry
    }
    const remaining = timeoutMs - (Date.now() - started);
    if (remaining <= 0) break;
    await sleep(Math.min(POLL_INTERVAL_MS, remaining), signal);
  }
  return "timeout";
}

function tokenFromStoredSession(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const session = JSON.parse(raw) as unknown;
    if (!isValidSession(session)) return null;
    const token = session.token?.accessToken;
    return typeof token === "string" && token.length > 0 ? token : null;
  } catch {
    return null;
  }
}

async function readStoredPollarAccessToken(apiKey: string): Promise<string | null> {
  try {
    const hash = await hashApiKeyPrefix(apiKey);
    return tokenFromStoredSession(localStorage.getItem(pollarSessionStorageKey(hash)));
  } catch {
    return null;
  }
}

async function persistValidSession(apiKey: string, content: unknown): Promise<void> {
  if (!isValidSession(content)) return;
  try {
    const hash = await hashApiKeyPrefix(apiKey);
    localStorage.setItem(pollarSessionStorageKey(hash), JSON.stringify(content));
  } catch {
    // private mode — SozuPay session can still be established from the token
  }
}

async function loginHostedSession(params: {
  clientSessionId: string;
  apiKey: string;
}): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    pollarLoginTimeoutMs(pollarStellarNetworkForClient(params.apiKey)),
  );
  try {
    const km = new WebCryptoKeyManager(params.apiKey);
    await km.init();
    const dpopJwk = await km.getPublicJwk();

    const res = await fetch(`${POLLAR_SDK_BASE}${pollarSdkApiPath("/auth/login")}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-pollar-api-key": params.apiKey,
      },
      body: JSON.stringify({ clientSessionId: params.clientSessionId, dpopJwk }),
      signal: controller.signal,
    });
    const body = await res.json().catch(() => null);
    const accessToken = accessTokenFromLoginResponse(body);
    if (!accessToken) return null;

    const content = (body as { content?: unknown }).content;
    await persistValidSession(params.apiKey, content);
    return accessToken;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * After hosted Google OAuth, the original PollarClient.login() poll may be gone
 * because Pollar only window.close()s. Finish the session: wait until READY
 * (including GENERATING_WALLET), POST /auth/login, persist for restore.
 */
export async function completeHostedOAuthSession(params: {
  clientSessionId: string;
  apiKey: string;
}): Promise<string | null> {
  const outcome = await waitForPollarSessionReady(params.clientSessionId);

  if (outcome === "ready") {
    const token = await loginHostedSession(params);
    if (token) return token;
    return readStoredPollarAccessToken(params.apiKey);
  }

  if (outcome === "consumed") {
    return readStoredPollarAccessToken(params.apiKey);
  }

  return null;
}
