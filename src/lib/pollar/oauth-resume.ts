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
}

export function readPendingPollarOAuth(now: number = Date.now()): PendingPollarOAuth | null {
  for (const store of pollarStores()) {
    let raw: string | null = null;
    try {
      raw = store.getItem(POLLAR_PENDING_OAUTH_KEY);
    } catch {
      continue;
    }
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw) as PendingPollarOAuth;
      if (!parsed?.clientSessionId || typeof parsed.createdAt !== "number") continue;
      if (now - parsed.createdAt > PENDING_MAX_AGE_MS) {
        try {
          store.removeItem(POLLAR_PENDING_OAUTH_KEY);
        } catch {
          // ignore
        }
        continue;
      }
      return parsed;
    } catch {
      continue;
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
}

export function pollarOAuthCallbackUrl(origin: string): string {
  return `${origin.replace(/\/$/, "")}${POLLAR_OAUTH_CALLBACK_PATH}`;
}

/**
 * Phones and tablets. `window.open(..., features)` often returns null here;
 * open the OAuth tab with no feature string. Same-window is only the fallback
 * when that open is blocked.
 */
export function shouldUseSameWindowOAuth(userAgent: string): boolean {
  return /iPhone|iPad|iPod|Android/i.test(userAgent);
}
