import "server-only";

import { getSupabase } from "@/lib/supabase/server";

export async function saveOrgPasskeyExport(orgId: string, blob: string): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await getSupabase()
    .from("org_passkey_exports")
    .upsert({ org_id: orgId, blob, updated_at: now }, { onConflict: "org_id" });
  if (error) throw new Error(error.message);
}

export async function readOrgPasskeyExport(orgId: string): Promise<string | null> {
  const { data, error } = await getSupabase()
    .from("org_passkey_exports")
    .select("blob")
    .eq("org_id", orgId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const blob = (data as { blob?: string } | null)?.blob;
  return typeof blob === "string" && blob.trim() ? blob : null;
}
