import { getSupabase } from "@/lib/supabase/server";
import { normalizePublicSlug } from "@/lib/named-checkout/slugs";

export type StandingCheckout = {
  id: string;
  org_id: string;
  checkout_slug: string;
  amount_usd: string;
  live: boolean;
  deadline_at: string | null;
  created_at: string;
  updated_at: string;
};

function mapRow(row: Record<string, unknown>): StandingCheckout {
  return {
    id: String(row.id),
    org_id: String(row.org_id),
    checkout_slug: String(row.checkout_slug),
    amount_usd: String(row.amount_usd),
    live: Boolean(row.live),
    deadline_at: typeof row.deadline_at === "string" ? row.deadline_at : null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

export async function createStandingCheckout(params: {
  id: string;
  orgId: string;
  checkoutSlug: string;
  amountUsd: string;
  live?: boolean;
  deadlineAt?: string | null;
}): Promise<StandingCheckout> {
  const now = new Date().toISOString();
  const slug = normalizePublicSlug(params.checkoutSlug);
  if (!slug) throw new Error("Invalid checkout slug");
  const { data, error } = await getSupabase()
    .from("standing_checkouts")
    .insert({
      id: params.id,
      org_id: params.orgId,
      checkout_slug: slug,
      amount_usd: params.amountUsd,
      live: params.live ?? true,
      deadline_at: params.deadlineAt ?? null,
      created_at: now,
      updated_at: now,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return mapRow(data as Record<string, unknown>);
}

export async function getStandingCheckoutBySlug(
  orgId: string,
  checkoutSlug: string,
): Promise<StandingCheckout | null> {
  const slug = normalizePublicSlug(checkoutSlug);
  if (!slug) return null;
  const { data, error } = await getSupabase()
    .from("standing_checkouts")
    .select("*")
    .eq("org_id", orgId)
    .eq("checkout_slug", slug)
    .maybeSingle();
  if (error) {
    console.error("[standing-checkouts] getBySlug:", error.message);
    return null;
  }
  return data ? mapRow(data as Record<string, unknown>) : null;
}

export async function listStandingCheckoutsForOrg(orgId: string): Promise<StandingCheckout[]> {
  const { data, error } = await getSupabase()
    .from("standing_checkouts")
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[standing-checkouts] list:", error.message);
    return [];
  }
  return (data ?? []).map((row) => mapRow(row as Record<string, unknown>));
}

export async function updateStandingCheckout(
  id: string,
  orgId: string,
  updates: { live?: boolean; deadlineAt?: string | null; amountUsd?: string },
): Promise<StandingCheckout | null> {
  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (updates.live !== undefined) payload.live = updates.live;
  if (updates.deadlineAt !== undefined) payload.deadline_at = updates.deadlineAt;
  if (updates.amountUsd !== undefined) payload.amount_usd = updates.amountUsd;
  const { data, error } = await getSupabase()
    .from("standing_checkouts")
    .update(payload)
    .eq("id", id)
    .eq("org_id", orgId)
    .select()
    .maybeSingle();
  if (error) {
    console.error("[standing-checkouts] update:", error.message);
    return null;
  }
  return data ? mapRow(data as Record<string, unknown>) : null;
}
