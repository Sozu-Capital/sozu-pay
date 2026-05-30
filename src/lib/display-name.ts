import { getPrivyDisplayName } from "@/lib/auth/privyDisplayName";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Hide Privy IDs, synthetic org auth emails, and raw UUIDs from UI labels. */
export function isInternalOrOpaqueLabel(value: string): boolean {
  const s = value.trim();
  if (!s) return true;
  if (UUID_RE.test(s)) return true;
  if (s.startsWith("did:")) return true;
  if (/^user-[0-9a-f-]+$/i.test(s)) return true;
  if (s.endsWith("@sozupay-org.internal")) return true;
  return false;
}

export function resolveAccountDisplayName(
  privyUser: unknown,
  email: string | null | undefined,
  fallback: string,
  username?: string | null
): string {
  const tag = (username ?? "").trim().replace(/^\$/, "");
  if (tag && !isInternalOrOpaqueLabel(tag)) {
    return `$${tag}`;
  }

  const fromPrivy = getPrivyDisplayName(privyUser, email ?? "");
  if (!isInternalOrOpaqueLabel(fromPrivy)) return fromPrivy;

  const mail = (email ?? "").trim();
  if (mail && !isInternalOrOpaqueLabel(mail) && mail.includes("@")) {
    const local = mail.split("@")[0]?.replace(/[._+-]+/g, " ").trim();
    if (local && !isInternalOrOpaqueLabel(local)) {
      return local
        .split(/\s+/)
        .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
        .join(" ");
    }
    if (!isInternalOrOpaqueLabel(mail)) return mail;
  }

  return fallback;
}
