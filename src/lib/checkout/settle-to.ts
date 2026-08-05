import type { Organization } from "@/lib/db/organizations";

/**
 * Settlement destination for Checkout / Funding links.
 * NGO Pollar path: Org treasury wallet (classic G bound at org create).
 * Merchant / legacy: prefer treasury smart account, then classic G / Soroban.
 */
export function resolveCheckoutSettleToAddress(org: Organization): string | null {
  const classicG = org.stellar_disbursement_public_key?.trim() || null;
  const sorobanC =
    org.treasury_contract_id?.trim() ||
    org.soroban_contract_id?.trim() ||
    null;
  const treasurySmartAccountAddress =
    org.treasury_smart_account_address?.trim() || null;

  if (org.type === "ngo") {
    return classicG ?? treasurySmartAccountAddress ?? sorobanC ?? null;
  }
  return treasurySmartAccountAddress ?? classicG ?? sorobanC ?? null;
}
