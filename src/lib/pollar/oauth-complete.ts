"use client";

import { isValidSession, WebCryptoKeyManager } from "@pollar/core";
import {
  accessTokenFromLoginResponse,
  hashApiKeyPrefix,
  pollarSessionStorageKey,
} from "@/lib/pollar/oauth-resume";

const POLLAR_SDK_BASE =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_POLLAR_SDK_BASE?.replace(/\/$/, "")) ||
  "https://sdk.api.pollar.xyz";

const POLL_INTERVAL_MS = 500;
const POLL_TIMEOUT_MS = 5 * 60 * 1000;

export async function waitForPollarSessionReady(clientSessionId: string): Promise<boolean> {
  const url = `${POLLAR_SDK_BASE}/v2/auth/session/status/${encodeURIComponent(clientSessionId)}/poll`;
  const started = Date.now();
  while (Date.now() - started < POLL_TIMEOUT_MS) {
    try {
      const res = await fetch(url, { headers: { accept: "application/json" } });
      if (res.status === 404 || res.status === 410) return false;
      const body = (await res.json().catch(() => null)) as {
        success?: boolean;
        code?: string;
        content?: { status?: string };
      } | null;
      if (body?.code === "INVALID_CLIENT_SESSION_ID" || body?.code === "EXPIRED_CLIENT_ID") {
        return false;
      }
      if (body?.success && body.content?.status === "READY") return true;
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  return false;
}

/**
 * After same-window Google OAuth, the original PollarClient.login() poll is gone.
 * Finish the hosted session: wait until READY, POST /auth/login, persist for restore.
 */
export async function completeHostedOAuthSession(params: {
  clientSessionId: string;
  apiKey: string;
}): Promise<string | null> {
  const ready = await waitForPollarSessionReady(params.clientSessionId);
  if (!ready) return null;

  const km = new WebCryptoKeyManager(params.apiKey);
  await km.init();
  const dpopJwk = await km.getPublicJwk();

  const res = await fetch(`${POLLAR_SDK_BASE}/v2/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-pollar-api-key": params.apiKey,
    },
    body: JSON.stringify({ clientSessionId: params.clientSessionId, dpopJwk }),
  });
  const body = await res.json().catch(() => null);
  const accessToken = accessTokenFromLoginResponse(body);
  if (!accessToken) return null;

  const content = (body as { content?: unknown }).content;
  if (isValidSession(content)) {
    try {
      const hash = await hashApiKeyPrefix(params.apiKey);
      localStorage.setItem(pollarSessionStorageKey(hash), JSON.stringify(content));
    } catch {
      // private mode — SozuPay session can still be established from the token
    }
  }

  return accessToken;
}
