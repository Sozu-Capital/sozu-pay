/** Dashboard auth: passkey + backup PIN only (no Privy). */
export type AuthProvider = "passkey";

export function getAuthProvider(): AuthProvider {
  return "passkey";
}

export function isPasskeyAuth(): boolean {
  return true;
}
