/** Pure checks for a store "retirar al banco" request on the P2P desk. */

export const USDC_MINOR_PER_UNIT = 10_000_000;

const SMART_ACCOUNT = /^C[A-Z2-7]{55}$/;
const ESCROW_ACCOUNT = /^G[A-Z2-7]{55}$/;

export type DeskCaps = {
  perOrderMinor: number;
  perPersonMinor: number;
  totalMinor: number;
  totalArs: number;
};

export function usdcStringToMinor(raw: string): number | null {
  const text = raw.trim();
  if (!/^\d+(\.\d{1,7})?$/.test(text)) return null;
  const [whole, frac = ""] = text.split(".");
  const minor = Number(whole) * USDC_MINOR_PER_UNIT + Number(frac.padEnd(7, "0"));
  if (!Number.isSafeInteger(minor) || minor <= 0) return null;
  return minor;
}

/** CBU, alias, or account number. The desk table allows 6–64 characters. */
export function normalizeDeskBankAlias(raw: string): string | null {
  const value = raw.trim();
  if (value.length < 6 || value.length > 64) return null;
  if (/\s/.test(value)) return null;
  return value;
}

export function canonicalSmartAccount(raw: string | null | undefined): string | null {
  const value = raw?.trim().toUpperCase() ?? "";
  return SMART_ACCOUNT.test(value) ? value : null;
}

export function canonicalEscrowAccount(raw: string | null | undefined): string | null {
  const value = raw?.trim().toUpperCase() ?? "";
  return ESCROW_ACCOUNT.test(value) ? value : null;
}

function rateMicro(rate: number): bigint {
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new Error("Invalid ARS rate");
  }
  return BigInt(Math.round(rate * 1_000_000));
}

/** Pesos in cents for a USDC minor amount at `rate` ARS per 1 USDC. */
export function arsCentsFor(usdcMinor: number, rate: number): number {
  const scale = BigInt(1_000_000);
  const unit = BigInt(USDC_MINOR_PER_UNIT);
  return Number((BigInt(usdcMinor) * rateMicro(rate) * BigInt(100)) / (unit * scale));
}

/** USDC cap, lowered when the peso ceiling buys less at this rate. */
export function effectiveDeskTotalMinor(caps: DeskCaps, rate: number): number {
  const scale = BigInt(1_000_000);
  const unit = BigInt(USDC_MINOR_PER_UNIT);
  const byArs = (BigInt(caps.totalArs) * unit * scale) / rateMicro(rate);
  const cap = BigInt(caps.totalMinor);
  return Number(byArs < cap ? byArs : cap);
}

function minorFromUsdcEnv(raw: string | undefined, fallback: string | null): number | null {
  const text = raw?.trim() || fallback;
  if (!text) return null;
  return usdcStringToMinor(text);
}

/**
 * Caps from env. Testnet uses the pilot defaults. Mainnet fails closed when any cap is missing.
 */
export function readDeskCaps(env: Record<string, string | undefined> = process.env): DeskCaps | null {
  const network = env.STELLAR_NETWORK?.trim().toLowerCase();
  const mainnet = network === "public" || network === "mainnet";
  const fallback = mainnet
    ? null
    : { perOrder: "30", perPerson: "30", total: "600", totalArs: "1000000" };
  const perOrderMinor = minorFromUsdcEnv(env.DESK_CAP_PER_ORDER_USDC, fallback?.perOrder ?? null);
  const perPersonMinor = minorFromUsdcEnv(env.DESK_CAP_PER_PERSON_USDC, fallback?.perPerson ?? null);
  const totalMinor = minorFromUsdcEnv(env.DESK_CAP_TOTAL_USDC, fallback?.total ?? null);
  const totalArsText = env.DESK_CAP_TOTAL_ARS?.trim() || fallback?.totalArs;
  const totalArs = totalArsText ? Number(totalArsText) : NaN;
  if (
    perOrderMinor == null ||
    perPersonMinor == null ||
    totalMinor == null ||
    !Number.isSafeInteger(totalArs) ||
    totalArs <= 0
  ) {
    return null;
  }
  return { perOrderMinor, perPersonMinor, totalMinor, totalArs };
}
