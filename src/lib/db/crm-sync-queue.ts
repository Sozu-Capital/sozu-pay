import { getSupabase } from "@/lib/supabase/server";

export type CrmSyncStatus = "pending" | "processing" | "done" | "failed";

export async function enqueueCrmSync(params: {
  organizationId: string;
  entityType: string;
  entityId: string;
  payload: Record<string, unknown>;
}): Promise<string> {
  const { data, error } = await getSupabase()
    .from("crm_sync_queue")
    .insert({
      organization_id: params.organizationId,
      entity_type: params.entityType,
      entity_id: params.entityId,
      payload: params.payload,
      status: "pending",
    })
    .select("id")
    .single();

  if (error) throw new Error(`enqueueCrmSync: ${error.message}`);
  return (data as { id: string }).id;
}

export async function listPendingCrmSync(limit: number): Promise<
  {
    id: string;
    organization_id: string;
    entity_type: string;
    entity_id: string;
    payload: Record<string, unknown>;
    attempts: number;
  }[]
> {
  const { data, error } = await getSupabase()
    .from("crm_sync_queue")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) return [];
  return (data ?? []) as {
    id: string;
    organization_id: string;
    entity_type: string;
    entity_id: string;
    payload: Record<string, unknown>;
    attempts: number;
  }[];
}

export async function markCrmSyncDone(id: string): Promise<void> {
  await getSupabase()
    .from("crm_sync_queue")
    .update({
      status: "done",
      processed_at: new Date().toISOString(),
    })
    .eq("id", id);
}

export async function markCrmSyncFailed(
  id: string,
  err: string,
  attempts: number
): Promise<void> {
  await getSupabase()
    .from("crm_sync_queue")
    .update({
      status: attempts >= 5 ? "failed" : "pending",
      last_error: err,
      attempts,
    })
    .eq("id", id);
}
