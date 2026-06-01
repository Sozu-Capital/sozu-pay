/** Stellar classic account (G…) or Soroban contract (C…). */
const CLASSIC_RE = /^G[A-Z0-9]{55}$/;
const CONTRACT_RE = /^C[A-Z0-9]{55}$/;

export function normalizeStellarAddressInput(raw: string): string {
  return raw.trim().toUpperCase();
}

export function isValidClassicStellarAddress(address: string): boolean {
  return CLASSIC_RE.test(normalizeStellarAddressInput(address));
}

export function isValidSorobanContractAddress(address: string): boolean {
  return CONTRACT_RE.test(normalizeStellarAddressInput(address));
}

export function isValidStellarReceiveAddress(address: string): boolean {
  const n = normalizeStellarAddressInput(address);
  return isValidClassicStellarAddress(n) || isValidSorobanContractAddress(n);
}

export function paymentRailForAddress(
  address: string
): "smart" | "legacy" | null {
  const n = normalizeStellarAddressInput(address);
  if (isValidSorobanContractAddress(n)) return "smart";
  if (isValidClassicStellarAddress(n)) return "legacy";
  return null;
}
