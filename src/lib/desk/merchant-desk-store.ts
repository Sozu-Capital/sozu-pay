import "server-only";

import { getSupabase } from "@/lib/supabase/server";

const BCRA_USD_URL = "https://api.bcra.gob.ar/estadisticascambiarias/v1.0/Cotizaciones/USD";

export async function quoteDeskArs(
  env: Record<string, string | undefined> = process.env,
): Promise<{ rate: number; source: string; at: string } | { error: string }> {
  const network = env.STELLAR_NETWORK?.trim().toLowerCase();
  const mainnet = network === "public" || network === "mainnet";
  if (!mainnet) {
    const rate = Number(env.DESK_TEST_ARS_RATE?.trim() || "1400");
    if (!Number.isFinite(rate) || rate <= 0) return { error: "DESK_TEST_ARS_RATE must be a positive number" };
    return { rate, source: "TASA DE PRUEBA", at: new Date().toISOString() };
  }
  try {
    const res = await fetch(BCRA_USD_URL, { cache: "no-store" });
    if (!res.ok) return { error: "ARS quote unavailable" };
    const body = (await res.json()) as { results?: { fecha?: string; detalle?: { codigoMoneda?: string; tipoCotizacion?: number }[] }[] };
    const results = body.results ?? [];
    let best: { rate: number; at: string } | null = null;
    for (const entry of results) {
      if (!entry?.fecha) continue;
      const usd = entry.detalle?.find((row) => row.codigoMoneda === "USD");
      const rate = usd?.tipoCotizacion;
      if (typeof rate !== "number" || !(rate > 0)) continue;
      if (!best || entry.fecha > best.at) best = { rate, at: entry.fecha };
    }
    if (!best) return { error: "ARS quote unavailable" };
    return { rate: best.rate, source: "BCRA", at: new Date(`${best.at}T00:00:00.000Z`).toISOString() };
  } catch {
    return { error: "ARS quote unavailable" };
  }
}

export type DeskOrderRow = {
  id: string;
  status: string;
  usdc_minor: number;
  ars_cents: number;
  bank_alias: string;
  created_at: string;
};

const ACTIVE_DESK_STATUSES = ["open", "locked", "paid", "disputed", "releasing", "refunding"];

export type DeskCreateArgs = {
  userId: string;
  smartAccount: string;
  escrowAddress: string;
  usdcMinor: number;
  arsCents: number;
  rate: number;
  rateSource: string;
  rateAt: string;
  bankAlias: string;
  capPerOrderMinor: number;
  capPerPersonMinor: number;
  capTotalMinor: number;
};

export async function createDeskOrder(
  args: DeskCreateArgs,
): Promise<{ ok: true; id: string; status: string } | { ok: false; error: string }> {
  const { data, error } = await getSupabase().rpc("desk_create_order", {
    p_user_id: args.userId,
    p_smart_account: args.smartAccount,
    p_escrow_address: args.escrowAddress,
    p_usdc_minor: args.usdcMinor,
    p_ars_cents: args.arsCents,
    p_rate: args.rate,
    p_rate_source: args.rateSource,
    p_rate_at: args.rateAt,
    p_bank_alias: args.bankAlias,
    p_cap_per_order_minor: args.capPerOrderMinor,
    p_cap_per_person_minor: args.capPerPersonMinor,
    p_cap_total_minor: args.capTotalMinor,
  });
  if (error) {
    return { ok: false, error: error.message };
  }
  const row = (Array.isArray(data) ? data[0] : data) as { id?: string; status?: string } | null;
  if (!row?.id) return { ok: false, error: "empty_desk_order" };
  return { ok: true, id: row.id, status: row.status ?? "open" };
}

export async function listDeskOrdersForUser(userId: string): Promise<DeskOrderRow[]> {
  const { data, error } = await getSupabase()
    .from("desk_orders")
    .select("id, status, usdc_minor, ars_cents, bank_alias, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) {
    console.error("[desk] list orders:", error.message);
    return [];
  }
  return (data ?? []) as DeskOrderRow[];
}

export function deskOrderBlocksAnother(status: string): boolean {
  return ACTIVE_DESK_STATUSES.includes(status);
}
