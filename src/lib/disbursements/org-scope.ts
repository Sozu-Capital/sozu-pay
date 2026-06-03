import "server-only";

import { NextResponse } from "next/server";
import type { SdpDisbursement } from "@/lib/sdp/adminClient";
import {
  getDisbursementMetaAsync,
  getDisbursementHistory,
  type DisbursementMeta,
  type DisbursementHistoryRecord,
} from "@/lib/disbursements/store";

export function disbursementBelongsToOrg(
  meta: DisbursementMeta | null | undefined,
  orgId: string
): boolean {
  if (!orgId?.trim()) return false;
  return Boolean(meta?.orgId && meta.orgId === orgId);
}

export function filterDisbursementsForOrg(
  disbursements: SdpDisbursement[],
  metaById: Record<string, DisbursementMeta>,
  orgId: string
): SdpDisbursement[] {
  return disbursements.filter((d) => disbursementBelongsToOrg(metaById[d.id], orgId));
}

export function filterMetaForOrg(
  metaById: Record<string, DisbursementMeta>,
  orgId: string
): Record<string, DisbursementMeta> {
  const out: Record<string, DisbursementMeta> = {};
  for (const [id, meta] of Object.entries(metaById)) {
    if (disbursementBelongsToOrg(meta, orgId)) out[id] = meta;
  }
  return out;
}

export function getDisbursementHistoryForOrg(orgId: string): DisbursementHistoryRecord[] {
  return getDisbursementHistory().filter((h) => h.org_id === orgId);
}

type OrgAccessOk = { ok: true; meta: DisbursementMeta };
type OrgAccessFail = { ok: false; response: NextResponse };

export async function requireDisbursementOrgAccess(
  disbursementId: string,
  orgId: string
): Promise<OrgAccessOk | OrgAccessFail> {
  const meta = await getDisbursementMetaAsync(disbursementId);
  if (!disbursementBelongsToOrg(meta, orgId)) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: "Disbursement not found or not available for your organization.",
          code: "ORG_ACCESS_DENIED",
        },
        { status: 403 }
      ),
    };
  }
  return { ok: true, meta: meta! };
}
