/**
 * Payout caps from the caps sheet, in USDC. Amounts are compared in 7-decimal base units (stroops)
 * as bigint so float rounding can't let an over-limit payout through.
 *
 * Env: PAYOUT_MAX_PER_PAYOUT_USDC, PAYOUT_MAX_PER_RUN_USDC.
 * Mainnet (STELLAR_NETWORK=public) fails closed when either is missing; testnet treats a missing cap as none.
 */

const USDC_DECIMALS = 7;
const UNIT = BigInt(10) ** BigInt(USDC_DECIMALS);

/** Contract-level per-payout ceiling for testnet instances initialized without a configured cap. */
export const TESTNET_DEFAULT_CONTRACT_CAP_STROOPS = BigInt(1_000_000) * UNIT;

export type PayoutCaps = {
  maxPerPayout: bigint | null;
  maxPerRun: bigint | null;
};

export type CapsResult = { ok: true; caps: PayoutCaps } | { ok: false; error: string };

export type CapCheck = { ok: true; total: bigint } | { ok: false; error: string; index?: number };

/** Strict decimal USDC string → base units. Returns null for anything that isn't a plain non-negative decimal. */
export function usdcToStroops(amount: string): bigint | null {
  const trimmed = amount.trim();
  const match = /^(\d+)(?:\.(\d{1,7}))?$/.exec(trimmed);
  if (!match) return null;
  const whole = BigInt(match[1]);
  const frac = BigInt((match[2] ?? "").padEnd(USDC_DECIMALS, "0"));
  return whole * UNIT + frac;
}

export function formatStroops(value: bigint): string {
  const whole = value / UNIT;
  const frac = (value % UNIT).toString().padStart(USDC_DECIMALS, "0").replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : whole.toString();
}

function parseCap(name: string, raw: string | undefined): { ok: true; value: bigint | null } | { ok: false; error: string } {
  if (raw === undefined || raw.trim() === "") return { ok: true, value: null };
  const value = usdcToStroops(raw);
  if (value === null || value <= BigInt(0)) {
    return { ok: false, error: `${name} must be a positive USDC amount.` };
  }
  return { ok: true, value };
}

export function readPayoutCaps(env: Record<string, string | undefined> = process.env): CapsResult {
  const perPayout = parseCap("PAYOUT_MAX_PER_PAYOUT_USDC", env.PAYOUT_MAX_PER_PAYOUT_USDC);
  if (!perPayout.ok) return perPayout;
  const perRun = parseCap("PAYOUT_MAX_PER_RUN_USDC", env.PAYOUT_MAX_PER_RUN_USDC);
  if (!perRun.ok) return perRun;

  if (env.STELLAR_NETWORK === "public" && (perPayout.value === null || perRun.value === null)) {
    return {
      ok: false,
      error: "Payout caps are not configured for mainnet (PAYOUT_MAX_PER_PAYOUT_USDC, PAYOUT_MAX_PER_RUN_USDC).",
    };
  }
  return { ok: true, caps: { maxPerPayout: perPayout.value, maxPerRun: perRun.value } };
}

/** Check one run (a batch, or a single payout as a run of one) against the caps. */
export function checkPayoutCaps(amounts: readonly string[], caps: PayoutCaps): CapCheck {
  let total = BigInt(0);
  for (let i = 0; i < amounts.length; i++) {
    const value = usdcToStroops(amounts[i]);
    if (value === null || value <= BigInt(0)) {
      return { ok: false, error: `Invalid payout amount: ${amounts[i]}`, index: i };
    }
    if (caps.maxPerPayout !== null && value > caps.maxPerPayout) {
      return {
        ok: false,
        error: `Payout of ${amounts[i]} USDC is over the per-payout cap of ${formatStroops(caps.maxPerPayout)} USDC.`,
        index: i,
      };
    }
    total += value;
  }
  if (caps.maxPerRun !== null && total > caps.maxPerRun) {
    return {
      ok: false,
      error: `Run total of ${formatStroops(total)} USDC is over the per-run cap of ${formatStroops(caps.maxPerRun)} USDC.`,
    };
  }
  return { ok: true, total };
}

/** Read the caps and check a run in one step; any configuration problem blocks the payout. */
export function enforcePayoutCaps(
  amounts: readonly string[],
  env: Record<string, string | undefined> = process.env,
): CapCheck {
  const caps = readPayoutCaps(env);
  if (!caps.ok) return { ok: false, error: caps.error };
  return checkPayoutCaps(amounts, caps.caps);
}

/** Per-payout cap written into a newly initialized disbursement contract. */
export function contractPayoutCapStroops(env: Record<string, string | undefined> = process.env): bigint {
  const caps = readPayoutCaps(env);
  if (!caps.ok) throw new Error(caps.error);
  return caps.caps.maxPerPayout ?? TESTNET_DEFAULT_CONTRACT_CAP_STROOPS;
}
