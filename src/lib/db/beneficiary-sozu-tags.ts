import { getSupabase } from "@/lib/supabase/server";

/** Persist resolved Sozu tags per batch beneficiary (survives cold starts). */
export async function upsertBeneficiarySozuTags(
  disbursementId: string,
  tags: Array<{ email: string; sozuTag: string; stellarAddress?: string | null }>
): Promise<void> {
  const rows = tags
    .map(({ email, sozuTag, stellarAddress }) => ({
      disbursement_id: disbursementId,
      email: email.trim().toLowerCase(),
      sozu_tag: sozuTag.trim().replace(/^\$+/, ""),
      stellar_address: stellarAddress?.trim().toUpperCase() || null,
    }))
    .filter((r) => r.email && r.sozu_tag);

  if (rows.length === 0) return;

  const { error } = await getSupabase()
    .from("sdp_beneficiary_sozu_tags")
    .upsert(rows, { onConflict: "disbursement_id,email" });

  if (error) throw new Error(error.message);
}

export async function fetchBeneficiarySozuTags(
  disbursementId: string
): Promise<Record<string, string>> {
  const { data, error } = await getSupabase()
    .from("sdp_beneficiary_sozu_tags")
    .select("email, sozu_tag")
    .eq("disbursement_id", disbursementId);

  if (error) throw new Error(error.message);

  const out: Record<string, string> = {};
  for (const row of data ?? []) {
    const email = String(row.email ?? "").trim().toLowerCase();
    const tag = String(row.sozu_tag ?? "").trim().replace(/^\$+/, "");
    if (email && tag) out[email] = tag;
  }
  return out;
}
