/** Session keys for Pollar hosted OAuth across the Google redirect. */
export const POLLAR_RETURN_TO_KEY = "sozupay_pollar_return_to";
export const POLLAR_PENDING_OAUTH_KEY = "sozupay_pollar_pending_oauth";
export const POLLAR_OAUTH_CALLBACK_PATH = "/auth/pollar/callback";
export const POLLAR_OAUTH_HANDOFF_PATH = "/auth/pollar/google";
/** `window.name` of the tab opened for Google. The main app window never uses this. */
export const POLLAR_OAUTH_WINDOW_NAME = "pollar-oauth";
export const POLLAR_OAUTH_HANDOFF_KEY = "sozupay_pollar_oauth_handoff";
export const POLLAR_OAUTH_HANDOFF_CHANNEL = "sozupay_pollar_oauth_handoff";
export const POLLAR_OAUTH_HANDOFF_MESSAGE = "sozupay-pollar-oauth-handoff";
export const POLLAR_DESKTOP_OAUTH_FEATURES = "popup=yes,width=480,height=720";

export type PollarOAuthHandoff = {
  url: string;
  createdAt: number;
};

export type PollarOAuthOpenPlan =
  | { mode: "same-window" }
  | { mode: "new-tab"; target: string; features: string };

export type PendingPollarOAuth = {
  clientSessionId: string;
  createdAt: number;
};

const PENDING_MAX_AGE_MS = 10 * 60 * 1000;
const PENDING_COOKIE_MAX_AGE_SEC = 600;

/** Same-origin app path only — blocks open redirects. */
export function sanitizeReturnTo(returnTo: string | null | undefined): string | undefined {
  if (typeof returnTo !== "string") return undefined;
  const trimmed = returnTo.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//") || trimmed.includes("\\")) {
    return undefined;
  }
  return trimmed;
}

export function clientSessionIdFromOAuthUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const id = parsed.searchParams.get("client_session_id")?.trim();
    return id || null;
  } catch {
    return null;
  }
}

/** Pollar may append `client_session_id` when it sends the browser back to the callback. */
export function clientSessionIdFromCallbackSearch(search: string): string | null {
  const raw = search.startsWith("?") ? search.slice(1) : search;
  const id = new URLSearchParams(raw).get("client_session_id")?.trim();
  return id || null;
}

/**
 * Copy `client_session_id` onto `redirect_uri` so the callback still has it if
 * storage is wiped on the Google hop.
 */
export function withSessionIdOnRedirectUri(oauthUrl: string): string {
  try {
    const parsed = new URL(oauthUrl);
    const sessionId = parsed.searchParams.get("client_session_id")?.trim();
    const redirectUri = parsed.searchParams.get("redirect_uri");
    if (!sessionId || !redirectUri) return oauthUrl;
    const redirect = new URL(redirectUri);
    redirect.searchParams.set("client_session_id", sessionId);
    parsed.searchParams.set("redirect_uri", redirect.toString());
    return parsed.toString();
  } catch {
    return oauthUrl;
  }
}

export function isPollarOAuthPopupWindow(name: string): boolean {
  return name === POLLAR_OAUTH_WINDOW_NAME;
}

export function accessTokenFromLoginResponse(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const content = (body as { content?: { token?: { accessToken?: unknown } } }).content;
  const token = content?.token?.accessToken;
  return typeof token === "string" && token.length > 0 ? token : null;
}

export function pollarSessionStorageKey(apiKeyHash: string): string {
  return `pollar:${apiKeyHash}:session`;
}

/** First 16 bytes of SHA-256(apiKey) as hex — matches Pollar's storage namespace. */
export async function hashApiKeyPrefix(
  apiKey: string,
  digest: (data: Uint8Array) => Promise<Uint8Array> = sha256Bytes,
): Promise<string> {
  const bytes = await digest(new TextEncoder().encode(apiKey));
  let hex = "";
  for (let i = 0; i < 16; i++) hex += (bytes[i] ?? 0).toString(16).padStart(2, "0");
  return hex;
}

async function sha256Bytes(data: Uint8Array): Promise<Uint8Array> {
  const digest = await crypto.subtle.digest("SHA-256", data as BufferSource);
  return new Uint8Array(digest);
}

/**
 * sessionStorage is wiped by some mobile browsers on the Google hop, and a
 * popup cannot see the opener's sessionStorage. localStorage covers both.
 */
function pollarStores(): Storage[] {
  if (typeof window === "undefined") return [];
  const stores: Storage[] = [];
  for (const store of [window.sessionStorage, window.localStorage]) {
    try {
      if (store) stores.push(store);
    } catch {
      // private mode
    }
  }
  return stores;
}

function pendingOAuthCookie(raw: string, maxAgeSec: number): string {
  const secure =
    typeof window !== "undefined" && window.location?.protocol === "https:";
  return `${POLLAR_PENDING_OAUTH_KEY}=${encodeURIComponent(raw)}; Path=/; Max-Age=${maxAgeSec}; SameSite=Lax${secure ? "; Secure" : ""}`;
}

function writePendingOAuthCookie(raw: string | null): void {
  if (typeof document === "undefined") return;
  try {
    document.cookie = pendingOAuthCookie(raw ?? "", raw ? PENDING_COOKIE_MAX_AGE_SEC : 0);
  } catch {
    // ignore
  }
}

export function parsePendingPollarOAuth(
  raw: string | null | undefined,
  now: number,
): PendingPollarOAuth | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PendingPollarOAuth;
    if (!parsed?.clientSessionId || typeof parsed.createdAt !== "number") return null;
    if (now - parsed.createdAt > PENDING_MAX_AGE_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function pendingOAuthFromCookieHeader(
  cookieHeader: string | null | undefined,
  now: number,
): PendingPollarOAuth | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    const name = part.slice(0, eq).trim();
    if (name !== POLLAR_PENDING_OAUTH_KEY) continue;
    const value = part.slice(eq + 1).trim();
    try {
      return parsePendingPollarOAuth(decodeURIComponent(value), now);
    } catch {
      return null;
    }
  }
  return null;
}

export function persistPollarReturnTo(returnTo?: string): void {
  const clean = sanitizeReturnTo(returnTo);
  for (const store of pollarStores()) {
    try {
      if (clean) store.setItem(POLLAR_RETURN_TO_KEY, clean);
      else store.removeItem(POLLAR_RETURN_TO_KEY);
    } catch {
      // quota / private mode
    }
  }
}

export function readPollarReturnTo(): string | undefined {
  for (const store of pollarStores()) {
    try {
      const value = sanitizeReturnTo(store.getItem(POLLAR_RETURN_TO_KEY));
      if (value) return value;
    } catch {
      // ignore
    }
  }
  return undefined;
}

export function clearPollarReturnTo(): void {
  for (const store of pollarStores()) {
    try {
      store.removeItem(POLLAR_RETURN_TO_KEY);
    } catch {
      // ignore
    }
  }
}

export function persistPendingPollarOAuth(clientSessionId: string): void {
  const pending: PendingPollarOAuth = { clientSessionId, createdAt: Date.now() };
  const raw = JSON.stringify(pending);
  for (const store of pollarStores()) {
    try {
      store.setItem(POLLAR_PENDING_OAUTH_KEY, raw);
    } catch {
      // quota / private mode
    }
  }
  writePendingOAuthCookie(raw);
}

export function readPendingPollarOAuth(now: number = Date.now()): PendingPollarOAuth | null {
  for (const store of pollarStores()) {
    let raw: string | null = null;
    try {
      raw = store.getItem(POLLAR_PENDING_OAUTH_KEY);
    } catch {
      continue;
    }
    const parsed = parsePendingPollarOAuth(raw, now);
    if (parsed) return parsed;
    if (raw) {
      try {
        store.removeItem(POLLAR_PENDING_OAUTH_KEY);
      } catch {
        // ignore
      }
    }
  }
  if (typeof document !== "undefined") {
    try {
      return pendingOAuthFromCookieHeader(document.cookie, now);
    } catch {
      return null;
    }
  }
  return null;
}

export function clearPendingPollarOAuth(): void {
  for (const store of pollarStores()) {
    try {
      store.removeItem(POLLAR_PENDING_OAUTH_KEY);
    } catch {
      // ignore
    }
  }
  writePendingOAuthCookie(null);
}

export function pollarOAuthCallbackUrl(origin: string): string {
  return `${origin.replace(/\/$/, "")}${POLLAR_OAUTH_CALLBACK_PATH}`;
}

export function pollarOAuthHandoffHref(origin: string, now: number = Date.now()): string {
  return `${origin.replace(/\/$/, "")}${POLLAR_OAUTH_HANDOFF_PATH}?t=${now}`;
}

/** In-app WebViews that often swallow the Google OAuth return. */
export function isInAppBrowser(userAgent: string): boolean {
  return /FBAN|FBAV|Instagram|Line\/|Twitter|TikTok|Snapchat|LinkedInApp|WhatsApp|Messenger/i.test(
    userAgent,
  );
}

/** Phones, Android tablets, and iPadOS (Macintosh + touch). */
export function isPhoneLikeBrowser(userAgent: string, maxTouchPoints = 0): boolean {
  if (/iPhone|iPad|iPod|Android/i.test(userAgent)) return true;
  return /Macintosh/i.test(userAgent) && maxTouchPoints > 1;
}

export function pollarOAuthOpenPlan(
  userAgent: string,
  maxTouchPoints = 0,
): PollarOAuthOpenPlan {
  if (isInAppBrowser(userAgent)) return { mode: "same-window" };
  if (isPhoneLikeBrowser(userAgent, maxTouchPoints)) {
    return { mode: "new-tab", target: "_blank", features: "" };
  }
  return {
    mode: "new-tab",
    target: POLLAR_OAUTH_WINDOW_NAME,
    features: POLLAR_DESKTOP_OAUTH_FEATURES,
  };
}

/**
 * In-app browsers often swallow Google's return, so finish OAuth in this tab.
 * Safari/Chrome on phones keep this SozuPay tab and open Google in another.
 */
export function shouldUseSameWindowOAuth(userAgent: string): boolean {
  return pollarOAuthOpenPlan(userAgent).mode === "same-window";
}

/**
 * Reserve a Google tab whenever we are not forced into same-window OAuth.
 * Phones, Safari, and Chrome keep this SozuPay tab; Pollar only window.close()s.
 */
export function shouldReserveOAuthPopup(userAgent: string, maxTouchPoints = 0): boolean {
  return pollarOAuthOpenPlan(userAgent, maxTouchPoints).mode === "new-tab";
}

const ALLOWED_HANDOFF_HOSTS = new Set([
  "sdk.api.pollar.xyz",
  "api.pollar.xyz",
  "www.pollar.xyz",
  "pollar.xyz",
  "accounts.google.com",
  "accounts.youtube.com",
]);

export function isAllowedPollarHandoffUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;
    return ALLOWED_HANDOFF_HOSTS.has(parsed.hostname);
  } catch {
    return false;
  }
}

export function parsePollarHandoffUrl(
  raw: string | null | undefined,
  now: number,
): string | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PollarOAuthHandoff;
    if (!parsed?.url || typeof parsed.url !== "string" || typeof parsed.createdAt !== "number") {
      return null;
    }
    if (now - parsed.createdAt > PENDING_MAX_AGE_MS) return null;
    if (!isAllowedPollarHandoffUrl(parsed.url)) return null;
    return parsed.url;
  } catch {
    return null;
  }
}

function localStorageOrNull(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function persistPollarHandoffUrl(url: string): void {
  const store = localStorageOrNull();
  if (!store) return;
  const payload: PollarOAuthHandoff = { url, createdAt: Date.now() };
  try {
    store.setItem(POLLAR_OAUTH_HANDOFF_KEY, JSON.stringify(payload));
  } catch {
    // quota / private mode
  }
}

export function readPollarHandoffUrl(now: number = Date.now()): string | null {
  const store = localStorageOrNull();
  if (!store) return null;
  let raw: string | null = null;
  try {
    raw = store.getItem(POLLAR_OAUTH_HANDOFF_KEY);
  } catch {
    return null;
  }
  const url = parsePollarHandoffUrl(raw, now);
  if (!url && raw) {
    try {
      store.removeItem(POLLAR_OAUTH_HANDOFF_KEY);
    } catch {
      // ignore
    }
  }
  return url;
}

export function clearPollarHandoffUrl(): void {
  const store = localStorageOrNull();
  if (!store) return;
  try {
    store.removeItem(POLLAR_OAUTH_HANDOFF_KEY);
  } catch {
    // ignore
  }
}

export function consumePollarHandoffUrl(now: number = Date.now()): string | null {
  const url = readPollarHandoffUrl(now);
  if (url) clearPollarHandoffUrl();
  return url;
}

function openHandoffChannel(): BroadcastChannel | null {
  if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") return null;
  try {
    return new BroadcastChannel(POLLAR_OAUTH_HANDOFF_CHANNEL);
  } catch {
    return null;
  }
}

export function publishPollarHandoffUrl(url: string): void {
  persistPollarHandoffUrl(url);
  const channel = openHandoffChannel();
  if (!channel) return;
  try {
    channel.postMessage({ type: POLLAR_OAUTH_HANDOFF_MESSAGE, url });
  } catch {
    // ignore
  }
  try {
    channel.close();
  } catch {
    // ignore
  }
}
