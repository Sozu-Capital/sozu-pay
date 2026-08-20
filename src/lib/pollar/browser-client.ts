"use client";

import { PollarClient } from "@pollar/core";
import type { AuthUrlOpener } from "@pollar/core";
import {
  clientSessionIdFromOAuthUrl,
  persistPendingPollarOAuth,
  pollarOAuthCallbackUrl,
  shouldUseSameWindowOAuth,
} from "@/lib/pollar/oauth-resume";

const POLLAR_STORAGE_PREFIX = "pollar:";
const POLLAR_KEYS_DB = "pollar-keys";

let client: PollarClient | null = null;
let clientApiKey: string | null = null;
let reservedPopup: Window | null = null;

export function getPollarPublishableKey(): string {
  return (process.env.NEXT_PUBLIC_POLLAR_PUBLISHABLE_KEY ?? "").trim();
}

export function isPollarFakeAuth(): boolean {
  return process.env.NEXT_PUBLIC_POLLAR_FAKE_AUTH === "true" || !getPollarPublishableKey();
}

/**
 * Must run synchronously in the Google click handler, before any await.
 * iOS WebKit only honors window.open inside the original user-gesture tick;
 * Pollar's SDK opens the popup after Promise.then + /auth/session, which is too late.
 */
export function reservePollarOAuthPopup(): Window | null {
  if (typeof window === "undefined") return null;
  discardReservedPollarOAuthPopup();
  if (shouldUseSameWindowOAuth(window.navigator.userAgent)) {
    reservedPopup = null;
    return null;
  }
  const popup = window.open("about:blank", "pollar-oauth", "popup=yes,width=480,height=720");
  if (popup) {
    try {
      popup.opener = null;
    } catch {
      // ignore
    }
  }
  reservedPopup = popup && !popup.closed ? popup : null;
  return reservedPopup;
}

export function discardReservedPollarOAuthPopup(): void {
  if (reservedPopup && !reservedPopup.closed) {
    try {
      reservedPopup.close();
    } catch {
      // ignore
    }
  }
  reservedPopup = null;
}

const sozuOpenAuthUrl: AuthUrlOpener = async ({ getUrl }) => {
  const popup = reservedPopup && !reservedPopup.closed ? reservedPopup : null;
  reservedPopup = null;

  const url = await getUrl();
  if (!url) {
    popup?.close();
    return;
  }

  if (popup && !popup.closed && !shouldUseSameWindowOAuth(window.navigator.userAgent)) {
    popup.location.href = url;
    return;
  }
  if (popup && !popup.closed) {
    try {
      popup.close();
    } catch {
      // ignore
    }
  }

  const sessionId = clientSessionIdFromOAuthUrl(url);
  if (sessionId) persistPendingPollarOAuth(sessionId);
  window.location.assign(url);
  await new Promise<void>(() => {
    /* page navigates away */
  });
};

/** One client per publishable key. Pollar warns (and can TDZ) if we construct/destroy per mount. */
export function getPollarBrowserClient(): PollarClient | null {
  if (typeof window === "undefined") return null;
  const apiKey = getPollarPublishableKey();
  if (!apiKey) return null;
  if (client && clientApiKey === apiKey) return client;
  client?.destroy();
  client = new PollarClient({
    apiKey,
    openAuthUrl: sozuOpenAuthUrl,
    oauthRedirectUri: pollarOAuthCallbackUrl(window.location.origin),
  });
  clientApiKey = apiKey;
  return client;
}

/** Drop the singleton so the next get() restores a session written after hosted OAuth. */
export function resetPollarBrowserClient(): void {
  try {
    client?.destroy();
  } catch {
    // ignore
  }
  client = null;
  clientApiKey = null;
}

export function clearPollarBrowserStorage(): void {
  if (typeof window === "undefined") return;
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(POLLAR_STORAGE_PREFIX)) keys.push(key);
    }
    for (const key of keys) localStorage.removeItem(key);
  } catch {
    // private mode
  }
  try {
    indexedDB.deleteDatabase(POLLAR_KEYS_DB);
  } catch {
    // ignore
  }
}

/** Revoke Pollar session so the next Google login is a clean OAuth, not a restore. */
export async function logoutPollarBrowserClient(): Promise<void> {
  try {
    if (client) {
      await client.ready();
      await client.logout();
      client.destroy();
    }
  } catch {
    // still wipe local state
  }
  client = null;
  clientApiKey = null;
  clearPollarBrowserStorage();
}
