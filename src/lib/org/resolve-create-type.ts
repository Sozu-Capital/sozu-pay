import { orgTypeFromTaxEntity, type TaxEntityType } from "@/lib/org-tax";
import type { OrgType } from "@/lib/db/organizations";

/**
 * Org type for POST /api/profile/org.
 * Pollar may create a store when the client asks for one (merchant door).
 * Otherwise Pollar defaults to ngo; passkey path still follows body type / tax.
 */
export function resolveCreateOrganizationType(params: {
  requestedType: "store" | "ngo" | undefined;
  taxEntity: TaxEntityType | null;
  pollarPath: boolean;
}): OrgType {
  if (params.requestedType === "store" || params.requestedType === "ngo") {
    return params.requestedType;
  }
  if (params.pollarPath) return "ngo";
  return orgTypeFromTaxEntity(params.taxEntity);
}
