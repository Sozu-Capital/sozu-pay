import { NextResponse } from "next/server";
import { getSessionUser, isOrgStaff } from "@/lib/auth/api-auth";
import { listCreditApplicationsForOrg } from "@/lib/db/credit-applications";
import type { CreditApplicationStatus } from "@/lib/credit/types";

export async function GET(req: Request) {
  const su = await getSessionUser();
  if (!su || !isOrgStaff(su.user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const orgId = su.user.org_id;
  if (!orgId) {
    return NextResponse.json({ error: "No organization" }, { status: 400 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") as CreditApplicationStatus | null;
  const apps = await listCreditApplicationsForOrg(
    orgId,
    status ?? undefined
  );
  return NextResponse.json({ applications: apps });
}
