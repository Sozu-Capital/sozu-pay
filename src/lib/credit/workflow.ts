import { createRecipientDb } from "@/lib/db/recipients";
import {
  createLoanFromPrincipalAndRate,
  deleteCreditAgreement,
  type CreditAgreementRow,
} from "@/lib/db/credit-agreements";
import {
  getCreditApplicationById,
  setApplicationReviewed,
  type CreditApplicationRow,
} from "@/lib/db/credit-applications";
import { getOrgCreditSettings } from "@/lib/db/org-credit-settings";
import { getUserById } from "@/lib/db/users";
import { getOrganizationById } from "@/lib/db/organizations";
import { sendCreditReviewEmail } from "@/lib/email/credit-notifications";
import { enqueueCrmSync } from "@/lib/db/crm-sync-queue";
import { processCrmSyncBatch } from "@/lib/crm/process-queue";

function profileName(profile: Record<string, unknown>): string {
  const full =
    typeof profile.full_name === "string"
      ? profile.full_name
      : typeof profile.fullName === "string"
        ? profile.fullName
        : "";
  return full.trim() || "Applicant";
}

function bankPlaceholder(profile: Record<string, unknown>): string {
  const cbu =
    typeof profile.cbu === "string"
      ? profile.cbu
      : typeof profile.CBU === "string"
        ? profile.CBU
        : "";
  return cbu.trim() || "pending";
}

export async function runPostReviewNotifications(
  app: CreditApplicationRow,
  outcome: "approved" | "rejected"
): Promise<void> {
  const applicant = await getUserById(app.applicant_user_id);
  const org = await getOrganizationById(app.organization_id);
  if (!applicant?.email || !org) return;

  const base =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "http://localhost:3000";

  await sendCreditReviewEmail({
    applicationId: app.id,
    toEmail: applicant.email,
    applicantName: profileName(app.applicant_profile),
    organizationName: org.name,
    outcome,
    portalUrl: `${base}/credit/my-loans`,
  });
}

export async function enqueueCreditApplicationCrmSync(
  app: CreditApplicationRow,
  orgName: string
): Promise<void> {
  if (!process.env.SALESFORCE_INSTANCE_URL) {
    return;
  }
  try {
    await enqueueCrmSync({
      organizationId: app.organization_id,
      entityType: "credit_application",
      entityId: app.id,
      payload: {
        Sozu_External_Id__c: app.id,
        Name: `${orgName} — ${profileName(app.applicant_profile)}`.slice(0, 80),
        Sozu_Status__c: app.status,
        Sozu_Principal__c: app.requested_principal,
        Sozu_OrgName__c: orgName,
      },
    });
  } catch (e) {
    console.error("[crm] enqueue failed", e);
  }
  void processCrmSyncBatch(5).catch((err) =>
    console.error("[crm] process batch", err)
  );
}

export async function approveCreditApplication(params: {
  applicationId: string;
  organizationId: string;
  reviewerPrivyId: string;
  reviewerUserId: number;
  internalNotes?: string | null;
}): Promise<{ loan: CreditAgreementRow }> {
  const app = await getCreditApplicationById(params.applicationId);
  if (!app || app.organization_id !== params.organizationId) {
    throw new Error("Application not found");
  }
  if (app.status !== "submitted" && app.status !== "under_review") {
    throw new Error("Invalid status for approval");
  }

  const settings = await getOrgCreditSettings(params.organizationId);
  const rate =
    app.annual_rate_pct != null
      ? Number(app.annual_rate_pct)
      : settings
        ? Number(settings.default_annual_rate_pct)
        : 36;

  const principal = Number(app.requested_principal);
  const n = app.num_installments;

  const profile = app.applicant_profile;
  const name = profileName(profile);
  const recipient = await createRecipientDb(
    params.reviewerPrivyId,
    name,
    bankPlaceholder(profile),
    (await getUserById(app.applicant_user_id))?.stellar_public_key ?? undefined,
    typeof profile.phone === "string" ? profile.phone : undefined
  );

  const startDate = new Date();
  let loanId: string | null = null;
  try {
    const { loan } = await createLoanFromPrincipalAndRate({
      organizationId: app.organization_id,
      applicationId: app.id,
      applicantUserId: app.applicant_user_id,
      recipientId: recipient.id,
      principal,
      annualRatePct: rate,
      numInstallments: n,
      startDate,
    });
    loanId = loan.id;

    const updated = await setApplicationReviewed({
      id: app.id,
      organizationId: params.organizationId,
      status: "approved",
      reviewerUserId: params.reviewerUserId,
      internalNotes: params.internalNotes ?? null,
    });
    if (!updated) {
      throw new Error("Failed to update application");
    }

    const org = await getOrganizationById(app.organization_id);
    if (org) {
      await enqueueCreditApplicationCrmSync(updated, org.name);
    }

    await runPostReviewNotifications(updated, "approved");

    return { loan };
  } catch (e) {
    if (loanId) {
      await deleteCreditAgreement(loanId);
    }
    throw e;
  }
}

export async function rejectCreditApplication(params: {
  applicationId: string;
  organizationId: string;
  reviewerUserId: number;
  rejectionReason?: string | null;
  internalNotes?: string | null;
}): Promise<CreditApplicationRow> {
  const app = await getCreditApplicationById(params.applicationId);
  if (!app || app.organization_id !== params.organizationId) {
    throw new Error("Application not found");
  }
  if (app.status !== "submitted" && app.status !== "under_review") {
    throw new Error("Invalid status for rejection");
  }

  const updated = await setApplicationReviewed({
    id: app.id,
    organizationId: params.organizationId,
    status: "rejected",
    reviewerUserId: params.reviewerUserId,
    rejectionReason: params.rejectionReason ?? null,
    internalNotes: params.internalNotes ?? null,
  });
  if (!updated) throw new Error("Failed to update application");

  const org = await getOrganizationById(app.organization_id);
  if (org) {
    await enqueueCreditApplicationCrmSync(updated, org.name);
  }

  await runPostReviewNotifications(updated, "rejected");

  return updated;
}
