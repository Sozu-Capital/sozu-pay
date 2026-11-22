/** Compressed P-256 / secp256k1 public keys as Pollar stores them (02/03 + 32 bytes). */
const COMPRESSED_KEY_RE = /\b(?:0x)?(0[23][0-9a-fA-F]{64})\b/g;

export function normalizeDevicePublicKey(raw: string): string {
  return raw.trim().toLowerCase().replace(/^0x/, "");
}

export function isCompressedDevicePublicKey(raw: string): boolean {
  return /^(0[23])[0-9a-f]{64}$/.test(normalizeDevicePublicKey(raw));
}

/** Pull every compressed device public key out of a Pollar/Turnkey payload or IndexedDB dump. */
export function extractCompressedPublicKeys(value: unknown): string[] {
  const found = new Set<string>();

  const take = (text: string) => {
    const normalized = normalizeDevicePublicKey(text);
    if (isCompressedDevicePublicKey(normalized)) {
      found.add(normalized);
      return;
    }
    COMPRESSED_KEY_RE.lastIndex = 0;
    for (const match of text.matchAll(COMPRESSED_KEY_RE)) {
      found.add(normalizeDevicePublicKey(match[1] ?? match[0]));
    }
  };

  const walk = (node: unknown, depth: number) => {
    if (node == null || depth > 12) return;
    if (typeof node === "string") {
      take(node);
      return;
    }
    if (typeof node === "number" || typeof node === "boolean") return;
    if (Array.isArray(node)) {
      for (const item of node) walk(item, depth + 1);
      return;
    }
    if (typeof node === "object") {
      for (const [key, child] of Object.entries(node)) {
        take(key);
        walk(child, depth + 1);
      }
    }
  };

  walk(value, 0);
  return [...found];
}

export type DeviceKeyMatch = {
  enrolledLocalKeys: string[];
  unenrolledLocalKeys: string[];
  enrolledOnlyKeys: string[];
  thisDeviceEnrolled: boolean;
};

export function classifyDeviceKeys(input: {
  localPublicKeys: string[];
  enrolledPublicKeys: string[];
}): DeviceKeyMatch {
  const local = uniqueNormalized(input.localPublicKeys);
  const enrolled = uniqueNormalized(input.enrolledPublicKeys);
  const enrolledSet = new Set(enrolled);
  const localSet = new Set(local);
  const enrolledLocalKeys = local.filter((key) => enrolledSet.has(key));
  return {
    enrolledLocalKeys,
    unenrolledLocalKeys: local.filter((key) => !enrolledSet.has(key)),
    enrolledOnlyKeys: enrolled.filter((key) => !localSet.has(key)),
    thisDeviceEnrolled: enrolledLocalKeys.length > 0,
  };
}

function uniqueNormalized(keys: string[]): string[] {
  return [...new Set(keys.map(normalizeDevicePublicKey).filter(isCompressedDevicePublicKey))];
}

export function isPollarSessionAuthError(message: string | null | undefined): boolean {
  if (!message) return false;
  return /SDK_AUTH_INVALID_TOKEN|SDK_AUTH_/i.test(message);
}

/** Empty enrolled lists are not a verdict when we never reached Turnkey. */
export function turnkeyMatchBlockedReason(input: {
  authStep: string;
  authVerified: boolean;
  devicesError: string | null;
}): "pollar_login_required" | "turnkey_unreachable" | null {
  if (input.authStep !== "authenticated" || !input.authVerified) {
    return "pollar_login_required";
  }
  if (isPollarSessionAuthError(input.devicesError)) return "pollar_login_required";
  if (input.devicesError) return "turnkey_unreachable";
  return null;
}

export function pollarErrorMessage(err: unknown): string {
  if (err instanceof Error && err.message.trim()) return err.message;
  if (typeof err === "string" && err.trim()) return err;
  if (err && typeof err === "object") {
    const body = err as {
      message?: unknown;
      code?: unknown;
      details?: unknown;
      body?: { message?: unknown; code?: unknown };
    };
    const parts = [
      body.message,
      body.code,
      body.details,
      body.body?.message,
      body.body?.code,
    ].filter((part): part is string => typeof part === "string" && part.trim().length > 0);
    if (parts.length) return parts.join(" ");
  }
  return "Unknown Pollar error";
}
