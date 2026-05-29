type PrivyLinkedAccount = {
  type?: string;
  name?: string | null;
  username?: string | null;
  address?: string;
};

type PrivyUserLike = {
  email?: { address?: string | null };
  google?: { name?: string | null; email?: string | null };
  linkedAccounts?: PrivyLinkedAccount[];
};

/** Best-effort full name from Privy (Google OAuth, linked accounts, email local-part). */
export function getPrivyDisplayName(user: unknown, fallbackEmail = ""): string {
  const privy = user as PrivyUserLike | null | undefined;
  const googleName = privy?.google?.name?.trim();
  if (googleName) return googleName;

  for (const account of privy?.linkedAccounts ?? []) {
    if (typeof account.name === "string" && account.name.trim()) {
      return account.name.trim();
    }
    if (account.type === "google_oauth" && typeof account.username === "string" && account.username.trim()) {
      return account.username.trim();
    }
  }

  const email = privy?.email?.address?.trim() || fallbackEmail.trim();
  if (email.includes("@")) {
    const local = email.split("@")[0]?.replace(/[._+-]+/g, " ").trim();
    if (local) {
      return local
        .split(/\s+/)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
    }
  }

  return email || "SozuPay user";
}
