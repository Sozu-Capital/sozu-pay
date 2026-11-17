/** Session keys for Pollar hosted OAuth across the Google redirect. */
export const POLLAR_RETURN_TO_KEY = "sozupay_pollar_return_to";
export const POLLAR_PENDING_OAUTH_KEY = "sozupay_pollar_pending_oauth";
export const POLLAR_OAUTH_CALLBACK_PATH = "/auth/pollar/callback";
/** `window.name` of the tab opened for Google. The main app window never uses this. */
export const POLLAR_OAUTH_WINDOW_NAME = "pollar-oauth";

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

/** In-app WebViews that often swallow the Google OAuth return. */
export function isInAppBrowser(userAgent: string): boolean {
  return /FBAN|FBAV|Instagram|Line\/|Twitter|TikTok|Snapchat|LinkedInApp|WhatsApp|Messenger/i.test(
    userAgent,
  );
}

/**
 * In-app browsers often swallow Google's return, so finish OAuth in this tab.
 * Safari/Chrome on phones keep this SozuPay tab and open Google in another.
 */
export function shouldUseSameWindowOAuth(userAgent: string): boolean {
  return isInAppBrowser(userAgent);
}

/**
 * Reserve a named Google tab whenever we are not forced into same-window OAuth.
 * Phones, Safari, and Chrome keep this SozuPay tab; Pollar only window.close()s.
 */
export function shouldReserveOAuthPopup(userAgent: string, maxTouchPoints = 0): boolean {
  void maxTouchPoints;
  return !shouldUseSameWindowOAuth(userAgent);
}
