import { getSupabase } from "@/lib/supabase/server";
import type { CreditApplicationStatus } from "@/lib/credit/types";
import type { CreditSimulation } from "@/lib/credit/types";

export type CreditApplicationRow = {
  id: string;
  organization_id: string;
  applicant_user_id: number;
  status: CreditApplicationStatus;
  requested_principal: number;
  num_installments: number;
  annual_rate_pct: number | null;
  applicant_profile: Record<string, unknown>;
  simulation: CreditSimulation | null;
  internal_notes: string | null;
  rejection_reason: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  reviewer_user_id: number | null;
  created_at: string;
  updated_at: string;
};

export async function insertCreditApplication(params: {
  organizationId: string;
  applicantUserId: number;
  requestedPrincipal: number;
  numInstallments: number;
  annualRatePct: number | null;
  applicantProfile: Record<string, unknown>;
  simulation: CreditSimulation | null;
  status: CreditApplicationStatus;
  submittedAt?: string | null;
}): Promise<CreditApplicationRow> {
  const { data, error } = await getSupabase()
    .from("credit_applications")
    .insert({
      organization_id: params.organizationId,
      applicant_user_id: params.applicantUserId,
      requested_principal: params.requestedPrincipal,
      num_installments: params.numInstallments,
      annual_rate_pct: params.annualRatePct,
      applicant_profile: params.applicantProfile,
      simulation: params.simulation,
      status: params.status,
      submitted_at: params.submittedAt ?? null,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw new Error(`credit_applications insert: ${error.message}`);
  return data as CreditApplicationRow;
}

export async function updateCreditApplication(
  id: string,
  applicantUserId: number,
  patch: Partial<{
    requested_principal: number;
    num_installments: number;
    annual_rate_pct: number | null;
    applicant_profile: Record<string, unknown>;
    simulation: CreditSimulation | null;
    status: CreditApplicationStatus;
    submitted_at: string | null;
  }>
): Promise<CreditApplicationRow | null> {
  const { data, error } = await getSupabase()
    .from("credit_applications")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("applicant_user_id", applicantUserId)
    .select()
    .single();

  if (error) return null;
  return data as CreditApplicationRow;
}

export async function getCreditApplicationById(
  id: string
): Promise<CreditApplicationRow | null> {
  const { data, error } = await getSupabase()
    .from("credit_applications")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) return null;
  return (data as CreditApplicationRow) ?? null;
}

export async function listCreditApplicationsForApplicant(
  applicantUserId: number
): Promise<CreditApplicationRow[]> {
  const { data, error } = await getSupabase()
    .from("credit_applications")
    .select("*")
    .eq("applicant_user_id", applicantUserId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`listCreditApplicationsForApplicant: ${error.message}`);
  return (data as CreditApplicationRow[]) ?? [];
}

export async function listCreditApplicationsForOrg(
  organizationId: string,
  status?: CreditApplicationStatus
): Promise<CreditApplicationRow[]> {
  let q = getSupabase()
    .from("credit_applications")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });

  if (status) q = q.eq("status", status);

  const { data, error } = await q;
  if (error) throw new Error(`listCreditApplicationsForOrg: ${error.message}`);
  return (data as CreditApplicationRow[]) ?? [];
}

export async function setApplicationReviewed(params: {
  id: string;
  organizationId: string;
  status: "approved" | "rejected";

  reviewerUserId: number;
  rejectionReason?: string | null;
  internalNotes?: string | null;
}): Promise<CreditApplicationRow | null> {
  const { data, error } = await getSupabase()
    .from("credit_applications")
    .update({
      status: params.status,
      reviewed_at: new Date().toISOString(),
      reviewer_user_id: params.reviewerUserId,
      rejection_reason: params.rejectionReason ?? null,
      internal_notes: params.internalNotes ?? undefined,
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.id)
    .eq("organization_id", params.organizationId)
    .select()
    .single();

  if (error) return null;
  return data as CreditApplicationRow;
}
