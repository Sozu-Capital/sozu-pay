import { getSupabase } from "@/lib/supabase/server";

export async function hasCreditEmailBeenSent(
  applicationId: string,
  kind: string
): Promise<boolean> {
  const { data, error } = await getSupabase()
    .from("credit_email_log")
    .select("id")
    .eq("application_id", applicationId)
    .eq("kind", kind)
    .maybeSingle();

  if (error) return false;
  return !!data;
}

export async function logCreditEmailSent(
  applicationId: string,
  kind: string
): Promise<void> {
  await getSupabase().from("credit_email_log").insert({
    application_id: applicationId,
    kind,
  });
}
