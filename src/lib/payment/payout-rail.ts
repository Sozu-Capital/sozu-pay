import {
  isValidClassicStellarAddress,
  isValidSorobanContractAddress,
  normalizeStellarAddressInput,
} from "@/lib/payment/stellar-address";

export type PayoutRail = "classic" | "sac";

/**
 * How a funded classic G treasury must send USDC to this destination.
 * Horizon Payment ops only accept G accounts — C destinations need a SAC transfer.
 */
export function payoutRailForDestination(raw: string): PayoutRail | null {
  const address = normalizeStellarAddressInput(raw);
  if (isValidSorobanContractAddress(address)) return "sac";
  if (isValidClassicStellarAddress(address)) return "classic";
  return null;
}

export function assertHorizonPaymentDestination(raw: string): string {
  const address = normalizeStellarAddressInput(raw);
  if (isValidClassicStellarAddress(address)) return address;
  if (isValidSorobanContractAddress(address)) {
    throw new Error(
      "destination is invalid: Horizon Payment cannot send to a smart account (C…). Use a SAC transfer.",
    );
  }
  throw new Error("destination is invalid");
}
