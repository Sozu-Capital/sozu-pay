import "server-only";

import {
  createDisbursement,
  deleteDisbursement,
  listDisbursements,
  uploadInstructions,
  type SdpDisbursement,
} from "@/lib/sdp/adminClient";
import { verificationByEmailFromCsv, parseDisbursementCsvText } from "@/lib/disbursements/csv";
import {
  findInvalidVerificationRows,
  normalizeDisbursementCsvText,
} from "@/lib/disbursements/normalizeVerification";
import { getAllDisbursementMetaAsync } from "@/lib/disbursements/store";

export type PublishBatchValidationError = {
  ok: false;
  status: number;
  error: string;
  code?: string;
};

export type PublishBatchParams = {
  name: string;
  walletId: string;
  assetId: string;
  csvBuffer: Buffer;
  fileName?: string;
};

const EDITABLE_SDP_STATUSES = new Set(["DRAFT", "READY"]);

/** Lowercased emails that appear more than once in disbursement CSV text. */
export function findDuplicateEmailsInCsv(csvText: string): string[] {
  let rows;
  try {
    rows = parseDisbursementCsvText(csvText);
  } catch {
    return [];
  }
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const r of rows) {
    const email = r.email.trim().toLowerCase();
    if (!email) continue;
    if (seen.has(email)) duplicates.add(email);
    else seen.add(email);
  }
  return [...duplicates];
}

/** Validate CSV locally before any SDP write. */
export function validateDisbursementCsvForPublish(
  rawCsv: string
): PublishBatchValidationError | { ok: true; normalizedCsv: string } {
  const normalizedCsv = normalizeDisbursementCsvText(rawCsv);
  const invalidRows = findInvalidVerificationRows(normalizedCsv);
  if (invalidRows.length > 0) {
    return {
      ok: false,
      status: 400,
      code: "INVALID_VERIFICATION",
      error:
        "Each CSV row needs a verification date (YYYY-MM-DD) in the verification column. " +
        `Missing or invalid on row(s): ${invalidRows.join(", ")}.`,
    };
  }

  const duplicateEmails = findDuplicateEmailsInCsv(normalizedCsv);
  if (duplicateEmails.length > 0) {
    return {
      ok: false,
      status: 400,
      code: "DUPLICATE_EMAIL",
      error:
        duplicateEmails.length === 1
          ? `Duplicate email in this batch: ${duplicateEmails[0]}. Each beneficiary must have a unique email before publishing.`
          : `Duplicate emails in this batch: ${duplicateEmails.join(", ")}. Each beneficiary must have a unique email before publishing.`,
    };
  }

  return { ok: true, normalizedCsv };
}

/**
 * Remove SDP batches that were never published in SozuPay (no org meta).
 * Cleans up failed publish attempts so retries with the same name or emails succeed.
 */
export async function removeUnpublishedDisbursementsByName(name: string): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) return;

  const [disbursements, meta] = await Promise.all([
    listDisbursements(),
    getAllDisbursementMetaAsync(),
  ]);

  for (const d of disbursements) {
    if (d.name.trim() !== trimmed) continue;
    if (meta[d.id]?.orgId) continue;
    if (!EDITABLE_SDP_STATUSES.has(d.status.toUpperCase())) continue;
    try {
      await deleteDisbursement(d.id);
    } catch (e) {
      console.warn(
        "[publishBatch] failed to delete unpublished orphan:",
        d.id,
        e instanceof Error ? e.message : e
      );
    }
  }
}

/**
 * Publish a batch to SDP atomically: validate locally, create, upload, or roll back on failure.
 * SozuPay meta/audit should only be written after this resolves successfully.
 */
export async function publishDisbursementBatchToSdp(
  params: PublishBatchParams
): Promise<{ disbursement: SdpDisbursement; normalizedCsv: string }> {
  const rawCsv = params.csvBuffer.toString("utf-8");
  const validated = validateDisbursementCsvForPublish(rawCsv);
  if (!validated.ok) {
    throw new PublishBatchError(validated.error, validated.status, validated.code);
  }

  await removeUnpublishedDisbursementsByName(params.name);

  const disbursement = await createDisbursement({
    name: params.name,
    walletId: params.walletId,
    assetId: params.assetId,
    registrationContactType: "EMAIL",
  });

  try {
    await uploadInstructions(
      disbursement.id,
      Buffer.from(validated.normalizedCsv, "utf-8"),
      params.fileName ?? "disbursement.csv"
    );
  } catch (e) {
    try {
      await deleteDisbursement(disbursement.id);
    } catch (rollbackErr) {
      console.error(
        "[publishBatch] upload failed and rollback delete failed:",
        disbursement.id,
        rollbackErr instanceof Error ? rollbackErr.message : rollbackErr
      );
    }
    throw e;
  }

  return { disbursement, normalizedCsv: validated.normalizedCsv };
}

export class PublishBatchError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string
  ) {
    super(message);
    this.name = "PublishBatchError";
  }
}

export { verificationByEmailFromCsv };
