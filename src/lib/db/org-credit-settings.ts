import { getSupabase } from "@/lib/supabase/server";

export type OrgCreditSettingsRow = {
  organization_id: string;
  default_annual_rate_pct: number;
  currency: string;
  updated_at: string;
};

export async function getOrgCreditSettings(
  organizationId: string
): Promise<OrgCreditSettingsRow | null> {
  const { data, error } = await getSupabase()
    .from("org_credit_settings")
    .select("*")
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error) return null;
  return (data as OrgCreditSettingsRow) ?? null;
}

export async function upsertOrgCreditSettings(params: {
  organizationId: string;
  defaultAnnualRatePct: number;
  currency?: string;
}): Promise<OrgCreditSettingsRow> {
  const { data, error } = await getSupabase()
    .from("org_credit_settings")
    .upsert(
      {
        organization_id: params.organizationId,
        default_annual_rate_pct: params.defaultAnnualRatePct,
        currency: params.currency ?? "USD",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "organization_id" }
    )
    .select()
    .single();

  if (error) throw new Error(`upsertOrgCreditSettings: ${error.message}`);
  return data as OrgCreditSettingsRow;
}
