"use client";

import { PollarClient } from "@pollar/core";
import type { AuthUrlOpener, PollarClientConfig } from "@pollar/core";
import {
  pollarLoginTimeoutMs,
  pollarStellarNetworkForClient,
} from "@/lib/pollar/network";
import {
  clientSessionIdFromOAuthUrl,
  persistPendingPollarOAuth,
  pollarOAuthCallbackUrl,
  pollarOAuthHandoffHref,
  pollarOAuthOpenPlan,
  POLLAR_OAUTH_HANDOFF_MESSAGE,
  publishPollarHandoffUrl,
  shouldReserveOAuthPopup,
  shouldUseSameWindowOAuth,
  withSessionIdOnRedirectUri,
} from "@/lib/pollar/oauth-resume";

const POLLAR_STORAGE_PREFIX = "pollar:";
/** Turnkey device-key store. Must survive logout — deleting it burns the vote. */
export const POLLAR_KEYS_DB = "pollar-keys";

let client: PollarClient | null = null;
let clientApiKey: string | null = null;
let reservedPopup: Window | null = null;
let oauthPopup: Window | null = null;

export type PollarGoogleOpen = {
  url: string | null;
  needsTap: boolean;
};

type GoogleOpenListener = (state: PollarGoogleOpen) => void;

let googleOpenState: PollarGoogleOpen = { url: null, needsTap: false };
const googleOpenListeners = new Set<GoogleOpenListener>();

function setGoogleOpen(state: PollarGoogleOpen): void {
  googleOpenState = state;
  for (const listener of googleOpenListeners) listener(state);
}

export function subscribePollarGoogleOpen(listener: GoogleOpenListener): () => void {
  googleOpenListeners.add(listener);
  listener(googleOpenState);
  return () => {
    googleOpenListeners.delete(listener);
  };
}

function isUsablePopup(popup: Window | null): popup is Window {
  return !!popup && !popup.closed && popup !== window;
}

export function getPollarPublishableKey(): string {
  return (process.env.NEXT_PUBLIC_POLLAR_PUBLISHABLE_KEY ?? "").trim();
}

export function isPollarFakeAuth(): boolean {
  return process.env.NEXT_PUBLIC_POLLAR_FAKE_AUTH === "true" || !getPollarPublishableKey();
}

function openHandoffWithAnchor(url: string): void {
  try {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.target = "_blank";
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } catch {
    // ignore
  }
}

/**
 * Must run synchronously in the Google click handler, before any await.
 * Open a same-origin handoff tab so this SozuPay tab stays alive. Pollar's
 * hosted success page only window.close()s — it never sends the browser back here.
 */
export function reservePollarOAuthPopup(): Window | null {
  if (typeof window === "undefined") return null;
  closePollarOAuthPopup();
  const ua = window.navigator.userAgent;
  const maxTouchPoints = window.navigator.maxTouchPoints ?? 0;
  if (!shouldReserveOAuthPopup(ua, maxTouchPoints)) {
    reservedPopup = null;
    oauthPopup = null;
    return null;
  }
  const plan = pollarOAuthOpenPlan(ua, maxTouchPoints);
  if (plan.mode !== "new-tab") {
    reservedPopup = null;
    oauthPopup = null;
    return null;
  }
  const url = pollarOAuthHandoffHref(window.location.origin);
  let popup: Window | null = null;
  try {
    popup = plan.features
      ? window.open(url, plan.target, plan.features)
      : window.open(url, plan.target);
  } catch {
    popup = null;
  }
  if (!isUsablePopup(popup)) {
    openHandoffWithAnchor(url);
    popup = null;
  }
  if (!isUsablePopup(popup)) {
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
  setGoogleOpen({ url: null, needsTap: false });
  if (!popup || popup.closed || popup === window || popupIsBackOnApp(popup)) return;
  try {
    popup.close();
  } catch {
    // ignore
  }
}

export function discardReservedPollarOAuthPopup(): void {
  closePollarOAuthPopup();
}

function sendUrlToHandoffTab(popup: Window | null, url: string): void {
  publishPollarHandoffUrl(url);
  if (!isUsablePopup(popup)) return;
  oauthPopup = popup;
  try {
    popup.location.replace(url);
  } catch {
    // still try postMessage
  }
  try {
    popup.postMessage({ type: POLLAR_OAUTH_HANDOFF_MESSAGE, url }, window.location.origin);
  } catch {
    // ignore
  }
}

const sozuOpenAuthUrl: AuthUrlOpener = async ({ getUrl }) => {
  const popup =
    (reservedPopup && isUsablePopup(reservedPopup) ? reservedPopup : null) ??
    (oauthPopup && isUsablePopup(oauthPopup) ? oauthPopup : null);
  reservedPopup = null;

  const rawUrl = await getUrl();
  if (!rawUrl) {
    closePollarOAuthPopup();
    return;
  }

  const url = withSessionIdOnRedirectUri(rawUrl);
  const sessionId = clientSessionIdFromOAuthUrl(url);
  if (sessionId) persistPendingPollarOAuth(sessionId);

  if (shouldUseSameWindowOAuth(window.navigator.userAgent)) {
    window.location.assign(url);
    return;
  }

  const needsTap = !isUsablePopup(popup);
  setGoogleOpen({ url, needsTap });
  sendUrlToHandoffTab(popup, url);
};

/** Derive stellarNetwork from `apiKey` itself. Next.js cannot inline NEXT_PUBLIC_* through a copied process.env object. */
export function pollarBrowserClientConfig(apiKey: string): PollarClientConfig {
  const stellarNetwork = pollarStellarNetworkForClient(apiKey);
  return {
    apiKey,
    stellarNetwork,
    loginTimeoutMs: pollarLoginTimeoutMs(stellarNetwork),
    openAuthUrl: sozuOpenAuthUrl,
    oauthRedirectUri:
      typeof window !== "undefined" ? pollarOAuthCallbackUrl(window.location.origin) : undefined,
  };
}

/** One client per publishable key. Pollar warns (and can TDZ) if we construct/destroy per mount. */
export function getPollarBrowserClient(): PollarClient | null {
  if (typeof window === "undefined") return null;
  const apiKey = getPollarPublishableKey();
  if (!apiKey) return null;
  if (client && clientApiKey === apiKey) return client;
  client?.destroy();
  client = new PollarClient(pollarBrowserClientConfig(apiKey));
  clientApiKey = apiKey;
  return client;
}

/** Bound `client.ready()` so a mainnet cold start cannot freeze Continue with Google. */
export async function waitForPollarClientReady(
  pollar: PollarClient,
  timeoutMs = 15_000,
): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      pollar.ready(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("Pollar client init timed out")), timeoutMs);
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
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

/**
 * Drops Pollar session tokens in localStorage.
 * Never deletes IndexedDB `pollar-keys`: that store is the Turnkey device vote.
 * Losing it locks co-signed wallets that have no passkey or email recovery.
 */
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
}

/** Revoke the Pollar OAuth session. Device keys stay so the next login can still vote. */
export async function logoutPollarBrowserClient(): Promise<void> {
  try {
    if (client) {
      await waitForPollarClientReady(client);
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
