import { getSupabase } from "@/lib/supabase/server";
import type { InstallmentScheduleRowStatus } from "@/lib/credit/types";
import type { CreditSimulation } from "@/lib/credit/types";
import { frenchAmortizationSchedule } from "@/lib/credit/amortization";

export type CreditAgreementRow = {
  id: string;
  organization_id: string;
  application_id: string;
  applicant_user_id: number;
  recipient_id: string | null;
  principal: number;
  annual_rate_pct: number;
  num_installments: number;
  start_date: string;
  currency: string;
  created_at: string;
};

export type InstallmentRow = {
  id: string;
  loan_id: string;
  installment_no: number;
  due_date: string;
  principal_due: number;
  interest_due: number;
  total_due: number;
  status: InstallmentScheduleRowStatus;
  created_at: string;
};

export async function createLoanFromSimulation(params: {
  organizationId: string;
  applicationId: string;
  applicantUserId: number;
  recipientId: string | null;
  principal: number;
  annualRatePct: number;
  numInstallments: number;
  startDate: Date;
  simulation: CreditSimulation;
}): Promise<{ loan: CreditAgreementRow; installments: InstallmentRow[] }> {
  const { data: loan, error: loanErr } = await getSupabase()
    .from("credit_agreements")
    .insert({
      organization_id: params.organizationId,
      application_id: params.applicationId,
      applicant_user_id: params.applicantUserId,
      recipient_id: params.recipientId,
      principal: params.principal,
      annual_rate_pct: params.annualRatePct,
      num_installments: params.numInstallments,
      start_date: params.startDate.toISOString().slice(0, 10),
      currency: "USD",
    })
    .select()
    .single();

  if (loanErr) throw new Error(`credit_agreements insert: ${loanErr.message}`);

  const loanRow = loan as CreditAgreementRow;
  const sched = params.simulation.installments;
  const rows = sched.map((row, i) => {
    const due = new Date(params.startDate);
    due.setMonth(due.getMonth() + i + 1);
    return {
      loan_id: loanRow.id,
      installment_no: row.index,
      due_date: due.toISOString().slice(0, 10),
      principal_due: row.principal,
      interest_due: row.interest,
      total_due: row.payment,
      status: "pending" as const,
    };
  });

  const { data: ins, error: insErr } = await getSupabase()
    .from("installment_schedule")
    .insert(rows)
    .select();

  if (insErr) throw new Error(`installment_schedule insert: ${insErr.message}`);

  return { loan: loanRow, installments: (ins as InstallmentRow[]) ?? [] };
}

export async function createLoanFromPrincipalAndRate(params: {
  organizationId: string;
  applicationId: string;
  applicantUserId: number;
  recipientId: string | null;
  principal: number;
  annualRatePct: number;
  numInstallments: number;
  startDate: Date;
}): Promise<{ loan: CreditAgreementRow; installments: InstallmentRow[] }> {
  const sim = frenchAmortizationSchedule({
    principal: params.principal,
    annualRatePct: params.annualRatePct,
    numInstallments: params.numInstallments,
  });
  return createLoanFromSimulation({
    organizationId: params.organizationId,
    applicationId: params.applicationId,
    applicantUserId: params.applicantUserId,
    recipientId: params.recipientId,
    principal: params.principal,
    annualRatePct: params.annualRatePct,
    numInstallments: params.numInstallments,
    startDate: params.startDate,
    simulation: sim,
  });
}

export async function listLoansForUser(
  applicantUserId: number
): Promise<CreditAgreementRow[]> {
  const { data, error } = await getSupabase()
    .from("credit_agreements")
    .select("*")
    .eq("applicant_user_id", applicantUserId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`listLoansForUser: ${error.message}`);
  return (data as CreditAgreementRow[]) ?? [];
}

export async function listLoansForOrganization(
  organizationId: string
): Promise<CreditAgreementRow[]> {
  const { data, error } = await getSupabase()
    .from("credit_agreements")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`listLoansForOrganization: ${error.message}`);
  return (data as CreditAgreementRow[]) ?? [];
}

export async function getLoanById(loanId: string): Promise<CreditAgreementRow | null> {
  const { data, error } = await getSupabase()
    .from("credit_agreements")
    .select("*")
    .eq("id", loanId)
    .maybeSingle();

  if (error) return null;
  return (data as CreditAgreementRow) ?? null;
}

export async function listInstallmentsForLoan(
  loanId: string
): Promise<InstallmentRow[]> {
  const { data, error } = await getSupabase()
    .from("installment_schedule")
    .select("*")
    .eq("loan_id", loanId)
    .order("installment_no", { ascending: true });

  if (error) throw new Error(`listInstallmentsForLoan: ${error.message}`);
  return (data as InstallmentRow[]) ?? [];
}

export async function sumRepaymentsForLoan(loanId: string): Promise<number> {
  const { data, error } = await getSupabase()
    .from("repayment_events")
    .select("amount")
    .eq("loan_id", loanId);

  if (error) return 0;
  const rows = (data ?? []) as { amount: number }[];
  return rows.reduce((s, r) => s + Number(r.amount), 0);
}

export async function deleteCreditAgreement(loanId: string): Promise<void> {
  await getSupabase().from("credit_agreements").delete().eq("id", loanId);
}
