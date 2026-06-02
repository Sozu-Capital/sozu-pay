import { normalizeVerificationForSdp } from "@/lib/disbursements/normalizeVerification";
import {
  externalIdAsBeneficiaryName,
  externalIdToDisplayName,
} from "@/lib/sdp/receiverDisplay";

export interface RecipientRow {
  name: string;
  email: string;
  phone?: string;
  amount: string;
  verification?: string;
}

/** Slug for SDP CSV `id` column from a full legal name. */
export function slugifyLegalName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

/** Email → YYYY-MM-DD verification from normalized disbursement CSV text. */
export function verificationByEmailFromCsv(csvText: string): Record<string, string> {
  const rows = parseDisbursementCsvText(csvText);
  const out: Record<string, string> = {};
  for (const r of rows) {
    const email = r.email.trim().toLowerCase();
    const dob = (r.verification ?? "").trim();
    if (email && dob) out[email] = dob;
  }
  return out;
}

export function recipientsToCSV(recipients: RecipientRow[], defaultAmount = ""): string {
  const rows = recipients.map((r) => {
    const id = slugifyLegalName(r.name);
    const email = r.email.trim();
    const amount = (r.amount || defaultAmount || "0").trim();
    const verification = normalizeVerificationForSdp((r.verification ?? "").trim()) ?? "";
    return `${email},${id},${amount},${verification}`;
  });
  return "email,id,amount,verification\n" + rows.join("\n");
}

function splitCsvLine(line: string): string[] {
  const cols: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === "," && !inQuotes) {
      cols.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  cols.push(current.trim());
  return cols;
}

/** Parse SDP disbursement CSV text into editable recipient rows. */
export function parseDisbursementCsvText(text: string): RecipientRow[] {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];

  const header = splitCsvLine(lines[0]).map((h) => h.toLowerCase());
  const emailIdx = header.indexOf("email");
  const idIdx = header.indexOf("id");
  const amountIdx = header.indexOf("amount");
  const verificationIdx = header.indexOf("verification");

  if (emailIdx === -1 || idIdx === -1) {
    throw new Error("CSV must include email and id columns");
  }

  const rows: RecipientRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]);
    const email = cols[emailIdx]?.trim() ?? "";
    const id = cols[idIdx]?.trim() ?? "";
    if (!email) continue;

    const nameFromId =
      externalIdAsBeneficiaryName(id) ??
      (id && !/^rcp[_-]?\d+$/i.test(id) ? externalIdToDisplayName(id) : "");

    rows.push({
      name: nameFromId,
      email,
      phone: "",
      amount: amountIdx >= 0 ? (cols[amountIdx]?.trim() ?? "") : "",
      verification:
        normalizeVerificationForSdp(
          verificationIdx >= 0 ? (cols[verificationIdx]?.trim() ?? "") : ""
        ) ?? "",
    });
  }
  return rows;
}

export function receiversToRecipientRows(
  receivers: Array<{
    email?: string;
    phone_number?: string;
    external_id?: string;
    payment?: { amount?: string; verification_field_value?: string; verification?: string } | null;
  }>
): RecipientRow[] {
  return receivers
    .filter((r) => r.email?.trim())
    .map((r) => ({
      name: externalIdAsBeneficiaryName(r.external_id ?? "") ?? "",
      email: r.email!.trim(),
      phone: r.phone_number?.trim() ?? "",
      amount: r.payment?.amount?.trim() ?? "",
      verification:
        normalizeVerificationForSdp(
          r.payment?.verification_field_value?.trim() ??
            r.payment?.verification?.trim() ??
            ""
        ) ?? "",
    }));
}
