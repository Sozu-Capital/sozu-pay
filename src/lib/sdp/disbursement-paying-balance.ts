/**
 * Distribuir preflight balance.
 * Contract USDC stays on the treasury and disbursement resolvers.
 * Classic G is the Pollar paying wallet and is still counted when a C id is set.
 * G is not added to the contract total: a split across wallets does not cover
 * a batch that neither wallet can pay.
 */

export type DisbursementFundsCheck =
  | { ok: true }
  | {
      ok: false;
      code: string;
      error: string;
      details?: Record<string, string | number>;
    };

export function disbursementPayingUsdc(input: {
  treasuryId: string | null;
  disbursementContractId: string | null;
  treasuryBal: number;
  disbursementBal: number;
  /** null when the org has no usable classic G. */
  classicGBal: number | null;
}): number {
  const contractCombined =
    input.treasuryId &&
    input.disbursementContractId &&
    input.treasuryId !== input.disbursementContractId
      ? input.treasuryBal + input.disbursementBal
      : Math.max(
          input.treasuryId ? input.treasuryBal : 0,
          input.disbursementContractId ? input.disbursementBal : 0,
        );

  if (input.classicGBal == null) return contractCombined;
  return Math.max(contractCombined, input.classicGBal);
}

export function evaluateDisbursementFunds(input: {
  required: number;
  treasuryId: string | null;
  disbursementContractId: string | null;
  treasuryBal: number;
  disbursementBal: number;
  classicGBal: number | null;
}): DisbursementFundsCheck {
  if (input.required <= 0) return { ok: true };

  if (!input.treasuryId && !input.disbursementContractId) {
    return {
      ok: false,
      code: "NO_ORG_TREASURY",
      error:
        "This organization has no Soroban treasury configured. Set up your org smart wallet before sending batch payments.",
    };
  }

  const orgCombined = disbursementPayingUsdc(input);
  if (orgCombined + 1e-9 < input.required) {
    return {
      ok: false,
      code: "INSUFFICIENT_ORG_BALANCE",
      error:
        `Org smart account has ${orgCombined.toFixed(2)} USDC but this batch requires ${input.required.toFixed(2)} USDC. ` +
        `Deposit USDC to your org smart account, then use Distribuir to pay registered beneficiaries.`,
      details: { required: input.required, orgBalance: orgCombined },
    };
  }

  return { ok: true };
}
