/**
 * Mainnet distribution, escrow, desk and fee-payer secrets live only in Vercel production env.
 * On mainnet (STELLAR_NETWORK=public) no secret material, encrypted or not, may be written to the database.
 */
export function secretPersistenceAllowed(network = process.env.STELLAR_NETWORK): boolean {
  return network !== "public";
}

export const MAINNET_SECRET_PERSISTENCE_ERROR =
  "Refusing to store organization secret material on mainnet; mainnet keys are env-only.";

export function hasSecretMaterial(...values: Array<string | null | undefined>): boolean {
  return values.some((v) => typeof v === "string" && v.trim() !== "");
}
