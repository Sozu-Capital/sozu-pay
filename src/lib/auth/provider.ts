/**
 * Auth provider selection. Default: passkey when Privy is not configured.
 */
export type AuthProvider = "passkey" | "privy";

export function getAuthProvider(): AuthProvider {
  const explicit = process.env.NEXT_PUBLIC_AUTH_PROVIDER ?? process.env.AUTH_PROVIDER;
  if (explicit === "privy" || explicit === "passkey") return explicit;
  if (process.env.NEXT_PUBLIC_PRIVY_APP_ID) return "privy";
  return "passkey";
}

export function isPasskeyAuth(): boolean {
  return getAuthProvider() === "passkey";
}

export function isPrivyAuth(): boolean {
  return getAuthProvider() === "privy";
}
