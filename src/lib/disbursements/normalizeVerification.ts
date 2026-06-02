/**
 * SDP DATE_OF_BIRTH verification must be YYYY-MM-DD (see stellar-disbursement-platform-backend
 * internal/utils/validation.go ValidateDateOfBirthVerification).
 */

/** Normalize to YYYY-MM-DD for SDP CSV `verification` column and invite `bd` param. */
export function normalizeDateOfBirthForSdp(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  const slash = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (slash) {
    const [, d, m, y] = slash;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  return null;
}

const DEFAULT_VERIFICATION = "2000-01-01";

/** Normalize a single verification cell before upload to SDP. Empty → null (caller must reject). */
export function normalizeVerificationForSdp(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  return normalizeDateOfBirthForSdp(trimmed) ?? null;
}

/** @deprecated Used only when reading legacy rows; do not write this default on new uploads. */
export function defaultVerificationWhenBlank(): string {
  return DEFAULT_VERIFICATION;
}

/**
 * Rewrite uploaded CSV so every `verification` value is YYYY-MM-DD.
 * Expects header row with a `verification` column (SDP disbursement format).
 */
export function normalizeDisbursementCsvText(csvText: string): string {
  const lines = csvText.replace(/^\uFEFF/, "").split(/\r?\n/);
  if (lines.length === 0) return csvText;

  const header = lines[0]!.split(",").map((h) => h.trim().toLowerCase());
  const verificationIdx = header.indexOf("verification");
  if (verificationIdx < 0) return csvText;

  const out = [lines[0]!];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]!;
    if (!line.trim()) continue;
    const cols = line.split(",");
    if (cols.length <= verificationIdx) {
      out.push(line);
      continue;
    }
    cols[verificationIdx] = normalizeVerificationForSdp(cols[verificationIdx] ?? "") ?? "";
    out.push(cols.join(","));
  }
  return out.join("\n");
}

/** Row numbers (1-based, excluding header) with missing or invalid verification. */
export function findInvalidVerificationRows(csvText: string): number[] {
  const lines = csvText.replace(/^\uFEFF/, "").split(/\r?\n/");
  if (lines.length < 2) return [];

  const header = lines[0]!.split(",").map((h) => h.trim().toLowerCase());
  const verificationIdx = header.indexOf("verification");
  if (verificationIdx < 0) return [1];

  const bad: number[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]!;
    if (!line.trim()) continue;
    const cols = line.split(",");
    const raw = cols[verificationIdx]?.trim() ?? "";
    if (!normalizeVerificationForSdp(raw)) bad.push(i);
  }
  return bad;
}
