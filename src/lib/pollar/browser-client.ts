"use client";

import { PollarClient } from "@pollar/core";
import type { AuthUrlOpener } from "@pollar/core";
import {
  clientSessionIdFromOAuthUrl,
  persistPendingPollarOAuth,
  POLLAR_OAUTH_WINDOW_NAME,
  pollarOAuthCallbackUrl,
  shouldUseSameWindowOAuth,
} from "@/lib/pollar/oauth-resume";

const POLLAR_STORAGE_PREFIX = "pollar:";
const POLLAR_KEYS_DB = "pollar-keys";

let client: PollarClient | null = null;
let clientApiKey: string | null = null;
let reservedPopup: Window | null = null;
let oauthPopup: Window | null = null;

function mobileOAuthUserAgent(): boolean {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent;
  const iPadDesktop = ua.includes("Macintosh") && window.navigator.maxTouchPoints > 1;
  return shouldUseSameWindowOAuth(ua) || iPadDesktop;
}

export function getPollarPublishableKey(): string {
  return (process.env.NEXT_PUBLIC_POLLAR_PUBLISHABLE_KEY ?? "").trim();
}

export function isPollarFakeAuth(): boolean {
  return process.env.NEXT_PUBLIC_POLLAR_FAKE_AUTH === "true" || !getPollarPublishableKey();
}

/**
 * Must run synchronously in the Google click handler, before any await.
 * iOS WebKit only honors window.open inside the original user-gesture tick,
 * and it rejects `window.open` when a feature string is passed.
 * The opened tab keeps `window.name` so the callback can finish sign-in there
 * if this page is frozen in the background.
 */
export function reservePollarOAuthPopup(): Window | null {
  if (typeof window === "undefined") return null;
  closePollarOAuthPopup();
  const popup = mobileOAuthUserAgent()
    ? window.open("about:blank", POLLAR_OAUTH_WINDOW_NAME)
    : window.open("about:blank", POLLAR_OAUTH_WINDOW_NAME, "popup=yes,width=480,height=720");
  if (!popup || popup.closed) {
    reservedPopup = null;
    oauthPopup = null;
    return null;
  }
  reservedPopup = popup;
  oauthPopup = popup;
  return popup;
}

function popupIsBackOnApp(popup: Window): boolean {
  try {
    return popup.location.href.startsWith(window.location.origin);
  } catch {
    return false;
  }
}

/** Close the Google tab while it is still on Pollar or Google. Leave it once it has returned to this app. */
export function closePollarOAuthPopup(): void {
  const popup = oauthPopup ?? reservedPopup;
  oauthPopup = null;
  reservedPopup = null;
  if (!popup || popup.closed || popupIsBackOnApp(popup)) return;
  try {
    popup.close();
  } catch {
    // ignore
  }
}

export function discardReservedPollarOAuthPopup(): void {
  closePollarOAuthPopup();
}

const sozuOpenAuthUrl: AuthUrlOpener = async ({ getUrl }) => {
  const popup =
    (reservedPopup && !reservedPopup.closed ? reservedPopup : null) ??
    (oauthPopup && !oauthPopup.closed ? oauthPopup : null);
  reservedPopup = null;

  const url = await getUrl();
  if (!url) {
    closePollarOAuthPopup();
    return;
  }

  const sessionId = clientSessionIdFromOAuthUrl(url);
  if (sessionId) persistPendingPollarOAuth(sessionId);

  if (popup && !popup.closed) {
    oauthPopup = popup;
    popup.location.href = url;
    return;
  }

  oauthPopup = null;
  window.location.assign(url);
  await new Promise<void>(() => {
    /* page navigates away; the callback finishes sign-in */
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
