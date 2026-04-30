import { NextResponse } from "next/server";
import { getSessionUser, isOrgStaff } from "@/lib/auth/api-auth";
import {
  getCreditApplicationById,
  updateCreditApplication,
} from "@/lib/db/credit-applications";
import { frenchAmortizationSchedule } from "@/lib/credit/amortization";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const su = await getSessionUser();
  if (!su) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const app = await getCreditApplicationById(id);
  if (!app) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const isApplicant = app.applicant_user_id === su.user.id;
  const isStaffForOrg =
    isOrgStaff(su.user) && su.user.org_id === app.organization_id;
  if (!isApplicant && !isStaffForOrg) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return NextResponse.json({ application: app });
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const su = await getSessionUser();
  if (!su) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const app = await getCreditApplicationById(id);
  if (!app || app.applicant_user_id !== su.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (app.status !== "draft") {
    return NextResponse.json({ error: "Only drafts are editable" }, { status: 400 });
  }

  const body = (await req.json()) as {
    requestedPrincipal?: number;
    numInstallments?: number;
    annualRatePct?: number | null;
    applicantProfile?: Record<string, unknown>;
    submit?: boolean;
  };

  const requestedPrincipal = Number(body.requestedPrincipal ?? app.requested_principal);
  const numInstallments = Math.max(
    1,
    Math.floor(Number(body.numInstallments ?? app.num_installments))
  );
  const rate =
    body.annualRatePct != null
      ? Number(body.annualRatePct)
      : app.annual_rate_pct != null
        ? Number(app.annual_rate_pct)
        : 36;

  let simulation = app.simulation;
  if (requestedPrincipal > 0 && numInstallments > 0) {
    try {
      simulation = frenchAmortizationSchedule({
        principal: requestedPrincipal,
        annualRatePct: rate,
        numInstallments,
      });
    } catch {
      /* keep previous */
    }
  }

  const submit = !!body.submit;
  const updated = await updateCreditApplication(id, su.user.id, {
    requested_principal: requestedPrincipal,
    num_installments: numInstallments,
    annual_rate_pct: body.annualRatePct ?? app.annual_rate_pct,
    applicant_profile: body.applicantProfile ?? app.applicant_profile,
    simulation,
    status: submit ? "submitted" : "draft",
    submitted_at: submit ? new Date().toISOString() : null,
  });

  return NextResponse.json({ application: updated });
}
