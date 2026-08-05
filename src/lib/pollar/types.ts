export type PollarVerifiedIdentity = {
  /** Stable Pollar end-user id (subject). */
  subject: string;
  email: string;
  /** Optional wallet address from Pollar session (Staff Pollar identity). */
  walletAddress?: string | null;
  authProvider?: string | null;
};

export interface PollarTokenVerifier {
  verify(token: string): Promise<PollarVerifiedIdentity>;
}

export class PollarTokenVerifyError extends Error {
  constructor(
    message: string,
    readonly code: string = "POLLAR_TOKEN_INVALID",
  ) {
    super(message);
    this.name = "PollarTokenVerifyError";
  }
}

/** Stable fake G-address for local/fake Pollar identity + treasury binding. */
export const FAKE_POLLAR_STAFF_WALLET =
  "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";
