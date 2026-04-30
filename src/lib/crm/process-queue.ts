import {
  listPendingCrmSync,
  markCrmSyncDone,
  markCrmSyncFailed,
} from "@/lib/db/crm-sync-queue";
import {
  getSalesforceCreditApplicationObject,
  upsertSalesforceSObject,
} from "@/lib/crm/salesforce";

const EXTERNAL_ID_FIELD =
  process.env.SALESFORCE_EXTERNAL_ID_FIELD ?? "Sozu_External_Id__c";

/**
 * Processes pending CRM rows (Salesforce PATCH upsert). Call from cron or after enqueue.
 */
export async function processCrmSyncBatch(limit = 10): Promise<{
  processed: number;
  errors: string[];
}> {
  const pending = await listPendingCrmSync(limit);
  const errors: string[] = [];
  let processed = 0;

  for (const row of pending) {
    const sobject = getSalesforceCreditApplicationObject();
    const externalId = row.entity_id;
    const fields = { ...row.payload } as Record<string, unknown>;
    fields[EXTERNAL_ID_FIELD] = externalId;
    const result = await upsertSalesforceSObject({
      sobject,
      externalIdField: EXTERNAL_ID_FIELD,
      externalId,
      fields,
    });

    if (result.ok) {
      await markCrmSyncDone(row.id);
      processed += 1;
    } else {
      errors.push(`${row.id}: ${result.error ?? "unknown"}`);
      await markCrmSyncFailed(row.id, result.error ?? "error", row.attempts + 1);
    }
  }

  return { processed, errors };
}
