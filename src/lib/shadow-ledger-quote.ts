/** Stellar USDC uses 7 decimals. */
export const USDC_MINOR_SCALE = 10_000_000;

/**
 * CLP (whole pesos) → USDC minor units using market CLP per 1 USDC + spread (bps).
 * Worse rate for merchant = higher effective CLP per USDC → fewer USDC.
 */
export function quoteClpToUsdcMinor(
  amountClp: number,
  marketClpPerUsdc: number,
  spreadBps: number
): { quotedUsdcMinor: bigint; effectiveClpPerUsdc: number } {
  if (!Number.isFinite(amountClp) || amountClp <= 0) {
    throw new Error("amountClp must be a positive finite number");
  }
  if (!Number.isFinite(marketClpPerUsdc) || marketClpPerUsdc <= 0) {
    throw new Error("marketClpPerUsdc must be positive");
  }
  const spreadMult = 1 + spreadBps / 10_000;
  const effectiveClpPerUsdc = marketClpPerUsdc * spreadMult;
  const usdc = amountClp / effectiveClpPerUsdc;
  const quotedUsdcMinor = BigInt(Math.max(1, Math.floor(usdc * USDC_MINOR_SCALE)));
  return { quotedUsdcMinor, effectiveClpPerUsdc };
}

export function usdcMinorToDisplayString(minor: bigint): string {
  const n = Number(minor) / USDC_MINOR_SCALE;
  return n.toFixed(7).replace(/\.?0+$/, "") || "0";
}

export function readShadowFxConfig(): { marketClpPerUsdc: number; spreadBps: number } {
  const raw = process.env.SHADOW_LEDGER_FX_CLP_PER_USDC;
  const market = raw != null && raw !== "" ? Number.parseFloat(raw) : 920;
  if (!Number.isFinite(market) || market <= 0) {
    throw new Error("Invalid SHADOW_LEDGER_FX_CLP_PER_USDC");
  }
  const spreadRaw = process.env.SHADOW_LEDGER_SPREAD_BPS;
  const spreadBps =
    spreadRaw != null && spreadRaw !== "" ? Number.parseInt(spreadRaw, 10) : 200;
  if (!Number.isFinite(spreadBps) || spreadBps < 0) {
    throw new Error("Invalid SHADOW_LEDGER_SPREAD_BPS");
  }
  return { marketClpPerUsdc: market, spreadBps };
}
