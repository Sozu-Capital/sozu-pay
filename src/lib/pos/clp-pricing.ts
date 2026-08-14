/**
 * Chile pilot POS pricing: merchants enter whole CLP; settlement rail stays USDC/Testnet.
 *
 * Conversion rule (documented for later payment-request / settle tickets):
 *   amountUsdc = amountClp / clpPerUsdc
 * where `clpPerUsdc` is:
 *   1. `POS_CLP_PER_USDC` env (preferred for stable pilot demos), else
 *   2. live Frankfurter USD→CLP when available, else
 *   3. pilot fallback {@link POS_CLP_PER_USDC_FALLBACK}.
 *
 * Merchants never type a crypto amount — only whole pesos.
 */

export const POS_PRICING_CURRENCY = "CLP" as const;

/** Whole pesos only for the Chile pilot keypad. */
export const POS_CLP_FRACTION_DIGITS = 0;

/** Demo fallback when env + Frankfurter are unavailable (~mid-2020s CLP/USD order of magnitude). */
export const POS_CLP_PER_USDC_FALLBACK = 950;

export type ClpPricingQuote = {
  amountClp: string;
  amountUsd: string;
  currency: typeof POS_PRICING_CURRENCY;
  clpPerUsdc: number;
  fxSource: string;
};

/** Parse a whole-peso CLP amount string. Rejects decimals and non-positive values. */
export function parseWholeClpAmount(raw: string): number | null {
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const n = Number(trimmed);
  if (!Number.isSafeInteger(n) || n <= 0) return null;
  return n;
}

/** Hero / total display for CLP (es-CL thousand separators, no decimals). */
export function formatClpDisplay(amount: string): string {
  const trimmed = amount.trim();
  if (!trimmed) return "0";
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return trimmed;
  return new Intl.NumberFormat("es-CL", {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(n);
}

export function resolveClpPerUsdcRate(input?: {
  envRate?: string | undefined;
  frankfurterClpPerUsd?: number | null;
}): { clpPerUsdc: number; fxSource: string } {
  const fromEnv = Number(input?.envRate ?? process.env.POS_CLP_PER_USDC ?? "");
  if (Number.isFinite(fromEnv) && fromEnv > 0) {
    return { clpPerUsdc: fromEnv, fxSource: "POS_CLP_PER_USDC" };
  }
  const live = input?.frankfurterClpPerUsd;
  if (typeof live === "number" && Number.isFinite(live) && live > 0) {
    return { clpPerUsdc: live, fxSource: "Frankfurter USD→CLP" };
  }
  return {
    clpPerUsdc: POS_CLP_PER_USDC_FALLBACK,
    fxSource: `pilot fallback ${POS_CLP_PER_USDC_FALLBACK}`,
  };
}

/** Convert whole CLP → USDC string (2 dp) using the pilot rule above. */
export function clpToUsdcAmount(
  amountClp: number,
  clpPerUsdc: number,
): string {
  if (!(amountClp > 0) || !(clpPerUsdc > 0)) {
    throw new Error("amountClp and clpPerUsdc must be positive");
  }
  const usdc = amountClp / clpPerUsdc;
  return usdc.toFixed(2);
}

export function buildClpPricingQuote(
  amountClpRaw: string,
  rateInput?: Parameters<typeof resolveClpPerUsdcRate>[0],
): ClpPricingQuote | null {
  const amountClp = parseWholeClpAmount(amountClpRaw);
  if (amountClp == null) return null;
  const { clpPerUsdc, fxSource } = resolveClpPerUsdcRate(rateInput);
  return {
    amountClp: String(amountClp),
    amountUsd: clpToUsdcAmount(amountClp, clpPerUsdc),
    currency: POS_PRICING_CURRENCY,
    clpPerUsdc,
    fxSource,
  };
}

/** Body fields POS sends / checkout create persists for CLP-priced charges. */
export function posCreatePayloadFields(quote: ClpPricingQuote) {
  return {
    amountClp: quote.amountClp,
    amountUsd: quote.amountUsd,
    pricingCurrency: quote.currency,
    clpPerUsdc: quote.clpPerUsdc,
    fxSource: quote.fxSource,
  };
}
