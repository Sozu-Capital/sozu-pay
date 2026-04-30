import { NextResponse } from "next/server";
import { getSessionUser, isOrgStaff } from "@/lib/auth/api-auth";
import {
  getOrgCreditSettings,
  upsertOrgCreditSettings,
} from "@/lib/db/org-credit-settings";

export async function GET() {
  const su = await getSessionUser();
  if (!su || !isOrgStaff(su.user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const orgId = su.user.org_id;
  if (!orgId) {
    return NextResponse.json({ error: "No organization" }, { status: 400 });
  }
  const row = await getOrgCreditSettings(orgId);
  return NextResponse.json({
    settings: row ?? {
      organization_id: orgId,
      default_annual_rate_pct: 36,
      currency: "USD",
    },
  });
}

export async function PUT(req: Request) {
  const su = await getSessionUser();
  if (!su || !isOrgStaff(su.user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const orgId = su.user.org_id;
  if (!orgId) {
    return NextResponse.json({ error: "No organization" }, { status: 400 });
  }

  const body = (await req.json()) as {
    defaultAnnualRatePct?: number;
    currency?: string;
  };
  const pct = Number(body.defaultAnnualRatePct);
  if (!Number.isFinite(pct) || pct < 0) {
    return NextResponse.json({ error: "Invalid defaultAnnualRatePct" }, { status: 400 });
  }

  const row = await upsertOrgCreditSettings({
    organizationId: orgId,
    defaultAnnualRatePct: pct,
    currency: body.currency,
  });
  return NextResponse.json({ settings: row });
}
