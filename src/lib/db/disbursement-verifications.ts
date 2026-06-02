import { getSupabase } from "@/lib/supabase/server";

/** Uploaded DOB per beneficiary (SDP stores bcrypt only). */
export async function upsertDisbursementVerifications(
  disbursementId: string,
  byEmail: Record<string, string>
): Promise<void> {
  const rows = Object.entries(byEmail)
    .map(([email, dob]) => ({
      disbursement_id: disbursementId,
      email: email.trim().toLowerCase(),
      date_of_birth: dob.trim(),
    }))
    .filter((r) => r.email && /^\d{4}-\d{2}-\d{2}$/.test(r.date_of_birth));

  if (rows.length === 0) return;

  const { error } = await getSupabase()
    .from("sdp_disbursement_verifications")
    .upsert(rows, { onConflict: "disbursement_id,email" });

  if (error) {
    throw new Error(error.message);
  }
}

export async function fetchDisbursementVerifications(
  disbursementId: string
): Promise<Record<string, string>> {
  const { data, error } = await getSupabase()
    .from("sdp_disbursement_verifications")
    .select("email, date_of_birth")
    .eq("disbursement_id", disbursementId);

  if (error) {
    throw new Error(error.message);
  }

  const out: Record<string, string> = {};
  for (const row of data ?? []) {
    const email = String(row.email ?? "").trim().toLowerCase();
    const dob = String(row.date_of_birth ?? "").trim();
    if (email && /^\d{4}-\d{2}-\d{2}$/.test(dob)) out[email] = dob;
  }
  return out;
}
