const AVATAR_DATA_URL =
  /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/;

/** Keep uploaded portraits small enough to store on the user or org row. */
export const AVATAR_DATA_URL_MAX_LENGTH = 180_000;

export function parseAvatarDataUrl(raw: unknown): string | null {
  if (raw === null || raw === "") return null;
  if (typeof raw !== "string" || !AVATAR_DATA_URL.test(raw)) {
    throw new Error("INVALID_AVATAR");
  }
  if (raw.length > AVATAR_DATA_URL_MAX_LENGTH) {
    throw new Error("AVATAR_TOO_LARGE");
  }
  return raw;
}

export function readStoredAvatar(value: unknown): string | null {
  return typeof value === "string" && value.startsWith("data:image/") ? value : null;
}

export function userAvatarStorageKey(userId: number | string | null | undefined): string | null {
  if (userId == null || userId === "") return null;
  return `sozupay:user-avatar:${userId}`;
}

export function orgAvatarStorageKey(orgId: string | null | undefined): string | null {
  const id = orgId?.trim();
  if (!id) return null;
  return `sozupay:org-avatar:${id}`;
}
