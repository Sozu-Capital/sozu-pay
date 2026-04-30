import { NextResponse } from "next/server";
import { getSessionUser, isOrgStaff } from "@/lib/auth/api-auth";
import {
  listInstallmentsForLoan,
  listLoansForOrganization,
  sumRepaymentsForLoan,
} from "@/lib/db/credit-agreements";
import { getUserById } from "@/lib/db/users";

export async function GET() {
  const su = await getSessionUser();
  if (!su || !isOrgStaff(su.user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const orgId = su.user.org_id;
  if (!orgId) {
    return NextResponse.json({ error: "No organization" }, { status: 400 });
  }

  const loans = await listLoansForOrganization(orgId);
  const today = new Date().toISOString().slice(0, 10);
  const rows = await Promise.all(
    loans.map(async (loan) => {
      const applicant = await getUserById(loan.applicant_user_id);
      const installments = await listInstallmentsForLoan(loan.id);
      const paid = await sumRepaymentsForLoan(loan.id);
      const totalDue = installments.reduce((s, i) => s + Number(i.total_due), 0);
      const outstanding = Math.max(0, totalDue - paid);
      const next = installments.find((i) => i.status !== "paid");
      let health: "on_track" | "at_risk" | "overdue" = "on_track";
      if (next && next.due_date < today) health = "overdue";
      else if (next && next.due_date <= today) health = "at_risk";

      return {
        loan,
        applicantEmail: applicant?.email ?? "—",
        outstanding,
        paid,
        nextDue: next?.due_date ?? null,
        health,
      };
    })
  );

  return NextResponse.json({ loans: rows });
}
