import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/api-auth";
import { getOrganizationById, getOrganizationByReferralCode } from "@/lib/db/organizations";
import { getOrgCreditSettings } from "@/lib/db/org-credit-settings";
import {
  insertCreditApplication,
  listCreditApplicationsForApplicant,
  updateCreditApplication,
} from "@/lib/db/credit-applications";
import { frenchAmortizationSchedule } from "@/lib/credit/amortization";

async function resolveOrgId(body: {
  organizationId?: string;
  referralCode?: string;
}): Promise<string | null> {
  if (body.organizationId) {
    const org = await getOrganizationById(body.organizationId);
    return org?.id ?? null;
  }
  if (body.referralCode) {
    const org = await getOrganizationByReferralCode(body.referralCode.trim());
    return org?.id ?? null;
  }
  const envOrg = process.env.NEXT_PUBLIC_CREDIT_DEFAULT_ORG_ID;
  if (envOrg) {
    const org = await getOrganizationById(envOrg);
    return org?.id ?? null;
  }
  return null;
}

export async function GET() {
  const su = await getSessionUser();
  if (!su) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const apps = await listCreditApplicationsForApplicant(su.user.id);
  return NextResponse.json({ applications: apps });
}

export async function POST(req: Request) {
  const su = await getSessionUser();
  if (!su) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as {
    organizationId?: string;
    referralCode?: string;
    requestedPrincipal?: number;
    numInstallments?: number;
    annualRatePct?: number | null;
    applicantProfile?: Record<string, unknown>;
    submit?: boolean;
    draftId?: string;
  };

  const orgId = await resolveOrgId({
    organizationId: body.organizationId,
    referralCode: body.referralCode,
  });
  if (!orgId) {
    return NextResponse.json(
      { error: "Unknown organization. Set referralCode, organizationId, or NEXT_PUBLIC_CREDIT_DEFAULT_ORG_ID." },
      { status: 400 }
    );
  }

  const requestedPrincipal = Number(body.requestedPrincipal ?? 0);
  const numInstallments = Math.max(1, Math.floor(Number(body.numInstallments ?? 12)));
  const settings = await getOrgCreditSettings(orgId);
  const rate =
    body.annualRatePct != null
      ? Number(body.annualRatePct)
      : settings
        ? Number(settings.default_annual_rate_pct)
        : 36;

  const applicantProfile = body.applicantProfile ?? {};
  let simulation = null;
  if (requestedPrincipal > 0 && numInstallments > 0) {
    try {
      simulation = frenchAmortizationSchedule({
        principal: requestedPrincipal,
        annualRatePct: rate,
        numInstallments,
      });
    } catch {
      simulation = null;
    }
  }

  const submit = !!body.submit;

  if (body.draftId) {
    const updated = await updateCreditApplication(body.draftId, su.user.id, {
      requested_principal: requestedPrincipal,
      num_installments: numInstallments,
      annual_rate_pct: body.annualRatePct ?? rate,
      applicant_profile: applicantProfile,
      simulation,
      status: submit ? "submitted" : "draft",
      submitted_at: submit ? new Date().toISOString() : null,
    });
    if (!updated) {
      return NextResponse.json({ error: "Draft not found" }, { status: 404 });
    }
    return NextResponse.json({ application: updated });
  }

  const created = await insertCreditApplication({
    organizationId: orgId,
    applicantUserId: su.user.id,
    requestedPrincipal,
    numInstallments,
    annualRatePct: body.annualRatePct ?? rate,
    applicantProfile,
    simulation,
    status: submit ? "submitted" : "draft",
    submittedAt: submit ? new Date().toISOString() : null,
  });

  return NextResponse.json({ application: created });
}
