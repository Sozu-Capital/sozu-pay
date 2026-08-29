import { formatClpDisplay } from "@/lib/pos/clp-pricing";

export const STORE_RECONCILIATION_TIME_ZONE = "America/Santiago";

export type ReconciliationCharge = {
  id: string;
  amountClp: number;
  amountUsd: string | null;
  createdAt: string;
  completedAt: string;
  stellarTxHash: string | null;
  reference: string | null;
};

/** Confirmed PizzaToken redeems use status `submitted` (treasury credited). */
export type ReconciliationRedeem = {
  amount: number;
  confirmedAt: string;
  status: "pending" | "signed" | "submitted" | "failed";
};

export type StoreReconciliationSummary = {
  timeZone: string;
  todayClp: number;
  cycleClp: number;
  cycleChargeCount: number;
  todayChargeCount: number;
  /** Confirmed (submitted) PizzaToken redeems in today’s Santiago window. Not CLP. */
  todayPizzaRedeemCount: number;
  /** Confirmed (submitted) PizzaToken redeems in this week’s Santiago window. Not CLP. */
  cyclePizzaRedeemCount: number;
  cycleStartIso: string;
  todayStartIso: string;
  charges: ReconciliationCharge[];
};

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Local calendar date (Y-M-D) in `timeZone` for `instant`. */
export function localDateParts(
  instant: Date,
  timeZone: string,
): { year: number; month: number; day: number; weekday: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).formatToParts(instant);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const weekdayName = get("weekday");
  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    weekday: weekdayMap[weekdayName] ?? 1,
  };
}

/**
 * Instant of local midnight for Y-M-D in `timeZone`.
 * Uses a UTC guess then corrects by the zone offset at that local day.
 */
export function zonedMidnightUtc(
  year: number,
  month: number,
  day: number,
  timeZone: string,
): Date {
  const guess = Date.UTC(year, month - 1, day, 12, 0, 0);
  const asLocal = localDateParts(new Date(guess), timeZone);
  const localNoon = Date.UTC(asLocal.year, asLocal.month - 1, asLocal.day, 12, 0, 0);
  const shiftDays = Math.round((Date.UTC(year, month - 1, day, 12, 0, 0) - localNoon) / 86_400_000);
  const noonUtc = guess + shiftDays * 86_400_000;
  const localAtNoon = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(noonUtc));
  const hour = Number(localAtNoon.find((p) => p.type === "hour")?.value ?? "12");
  const minute = Number(localAtNoon.find((p) => p.type === "minute")?.value ?? "0");
  return new Date(noonUtc - hour * 3_600_000 - minute * 60_000);
}

export function startOfLocalDay(instant: Date, timeZone: string): Date {
  const { year, month, day } = localDateParts(instant, timeZone);
  return zonedMidnightUtc(year, month, day, timeZone);
}

/** Monday 00:00 in `timeZone` containing `instant`. */
export function startOfLocalWeek(instant: Date, timeZone: string): Date {
  const parts = localDateParts(instant, timeZone);
  const daysFromMonday = (parts.weekday + 6) % 7;
  const monday = new Date(
    Date.UTC(parts.year, parts.month - 1, parts.day) - daysFromMonday * 86_400_000,
  );
  const m = localDateParts(monday, "UTC");
  return zonedMidnightUtc(m.year, m.month, m.day, timeZone);
}

export function parseClpAmount(raw: string | null | undefined): number {
  if (raw == null || raw === "") return 0;
  const n = Number.parseInt(String(raw).trim(), 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function summarizeStoreReconciliation(
  charges: ReconciliationCharge[],
  now: Date = new Date(),
  timeZone: string = STORE_RECONCILIATION_TIME_ZONE,
  redeems: ReconciliationRedeem[] = [],
): StoreReconciliationSummary {
  const todayStart = startOfLocalDay(now, timeZone);
  const cycleStart = startOfLocalWeek(now, timeZone);
  const todayMs = todayStart.getTime();
  const cycleMs = cycleStart.getTime();

  let todayClp = 0;
  let cycleClp = 0;
  let todayChargeCount = 0;
  let cycleChargeCount = 0;

  for (const charge of charges) {
    const t = new Date(charge.completedAt).getTime();
    if (Number.isNaN(t)) continue;
    if (t >= cycleMs) {
      cycleClp += charge.amountClp;
      cycleChargeCount += 1;
    }
    if (t >= todayMs) {
      todayClp += charge.amountClp;
      todayChargeCount += 1;
    }
  }

  let todayPizzaRedeemCount = 0;
  let cyclePizzaRedeemCount = 0;

  for (const redeem of redeems) {
    if (redeem.status !== "submitted") continue;
    const t = new Date(redeem.confirmedAt).getTime();
    if (Number.isNaN(t)) continue;
    const n = redeem.amount > 0 ? redeem.amount : 1;
    if (t >= cycleMs) cyclePizzaRedeemCount += n;
    if (t >= todayMs) todayPizzaRedeemCount += n;
  }

  return {
    timeZone,
    todayClp,
    cycleClp,
    cycleChargeCount,
    todayChargeCount,
    todayPizzaRedeemCount,
    cyclePizzaRedeemCount,
    cycleStartIso: cycleStart.toISOString(),
    todayStartIso: todayStart.toISOString(),
    charges,
  };
}

export function formatReconciliationClp(amount: number): string {
  return formatClpDisplay(String(Math.max(0, Math.floor(amount))));
}

export function reconciliationCsv(summary: StoreReconciliationSummary): string {
  const header =
    "id,completed_at,amount_clp,amount_usd,reference,stellar_tx_hash,pizza_redeem_count";
  const rows = summary.charges.map((c) => {
    const ref = (c.reference ?? "").replaceAll('"', '""');
    const hash = c.stellarTxHash ?? "";
    const usd = c.amountUsd ?? "";
    // Period (this week) PizzaToken count — same on every charge row; not CLP.
    return `${c.id},${c.completedAt},${c.amountClp},${usd},"${ref}",${hash},${summary.cyclePizzaRedeemCount}`;
  });
  if (rows.length === 0) {
    rows.push(
      `_pizza_period,${summary.cycleStartIso},0,,,"cycle_pizza_redeems",,${summary.cyclePizzaRedeemCount}`,
    );
  }
  return [header, ...rows].join("\n") + "\n";
}

export function formatCycleLabel(cycleStartIso: string, timeZone: string): string {
  const start = new Date(cycleStartIso);
  return new Intl.DateTimeFormat("es-CL", {
    timeZone,
    day: "numeric",
    month: "short",
  }).format(start);
}

export function isoDateInZone(instant: Date, timeZone: string): string {
  const { year, month, day } = localDateParts(instant, timeZone);
  return `${year}-${pad(month)}-${pad(day)}`;
}
