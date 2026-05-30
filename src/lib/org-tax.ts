import type { OrgType } from "@/lib/db/organizations";

export type TaxEntityType = "private_company" | "ngo";

export type OrgTaxProfile = {
  entityType?: TaxEntityType | null;
  legalName?: string | null;
  taxId?: string | null;
  registeredAddress?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
};

export function orgTypeFromTaxEntity(entity: TaxEntityType | null | undefined): OrgType {
  return entity === "private_company" ? "store" : "ngo";
}

export function parseTaxEntityType(raw: unknown): TaxEntityType | null {
  return raw === "private_company" || raw === "ngo" ? raw : null;
}

export function trimOrNull(v: unknown, max = 500): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (!s) return null;
  return s.slice(0, max);
}
