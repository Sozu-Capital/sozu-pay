/** Session keys for Pollar hosted OAuth across same-window mobile redirects. */
export const POLLAR_RETURN_TO_KEY = "sozupay_pollar_return_to";
export const POLLAR_PENDING_OAUTH_KEY = "sozupay_pollar_pending_oauth";
export const POLLAR_OAUTH_CALLBACK_PATH = "/auth/pollar/callback";

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

export function persistPollarReturnTo(returnTo?: string): void {
  if (typeof sessionStorage === "undefined") return;
  const clean = sanitizeReturnTo(returnTo);
  if (clean) sessionStorage.setItem(POLLAR_RETURN_TO_KEY, clean);
  else sessionStorage.removeItem(POLLAR_RETURN_TO_KEY);
}

export function readPollarReturnTo(): string | undefined {
  if (typeof sessionStorage === "undefined") return undefined;
  return sanitizeReturnTo(sessionStorage.getItem(POLLAR_RETURN_TO_KEY));
}

export function clearPollarReturnTo(): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.removeItem(POLLAR_RETURN_TO_KEY);
}

export function persistPendingPollarOAuth(clientSessionId: string): void {
  if (typeof sessionStorage === "undefined") return;
  const pending: PendingPollarOAuth = { clientSessionId, createdAt: Date.now() };
  sessionStorage.setItem(POLLAR_PENDING_OAUTH_KEY, JSON.stringify(pending));
}

export function readPendingPollarOAuth(now: number = Date.now()): PendingPollarOAuth | null {
  if (typeof sessionStorage === "undefined") return null;
  const raw = sessionStorage.getItem(POLLAR_PENDING_OAUTH_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PendingPollarOAuth;
    if (!parsed?.clientSessionId || typeof parsed.createdAt !== "number") return null;
    if (now - parsed.createdAt > PENDING_MAX_AGE_MS) {
      sessionStorage.removeItem(POLLAR_PENDING_OAUTH_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearPendingPollarOAuth(): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.removeItem(POLLAR_PENDING_OAUTH_KEY);
}

export function pollarOAuthCallbackUrl(origin: string): string {
  return `${origin.replace(/\/$/, "")}${POLLAR_OAUTH_CALLBACK_PATH}`;
}

/** Popup OAuth is unreliable on iOS/Android WebKit; use same-window redirect instead. */
export function shouldUseSameWindowOAuth(userAgent: string): boolean {
  return /iPhone|iPad|iPod|Android/i.test(userAgent);
}
