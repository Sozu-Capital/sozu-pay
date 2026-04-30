import { NextResponse } from "next/server";
import { getSessionUser, isOrgStaff } from "@/lib/auth/api-auth";
import { listCreditApplicationsForOrg } from "@/lib/db/credit-applications";
import {
  listInstallmentsForLoan,
  listLoansForOrganization,
  sumRepaymentsForLoan,
} from "@/lib/db/credit-agreements";

export async function GET() {
  const su = await getSessionUser();
  if (!su || !isOrgStaff(su.user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const orgId = su.user.org_id;
  if (!orgId) {
    return NextResponse.json({ error: "No organization" }, { status: 400 });
  }

  const [applications, loans] = await Promise.all([
    listCreditApplicationsForOrg(orgId),
    listLoansForOrganization(orgId),
  ]);

  const pendingApps = applications.filter(
    (a) => a.status === "submitted" || a.status === "under_review"
  );

  let totalOutstanding = 0;
  let overdueApprox = 0;
  const today = new Date().toISOString().slice(0, 10);

  for (const loan of loans) {
    const installments = await listInstallmentsForLoan(loan.id);
    const paid = await sumRepaymentsForLoan(loan.id);
    const totalDue = installments.reduce((s, i) => s + Number(i.total_due), 0);
    totalOutstanding += Math.max(0, totalDue - paid);
    for (const ins of installments) {
      if (ins.status !== "paid" && ins.due_date < today) {
        overdueApprox += Number(ins.total_due);
      }
    }
  }

  const totalPrincipal = loans.reduce((s, l) => s + Number(l.principal), 0);

  return NextResponse.json({
    pendingApplicationCount: pendingApps.length,
    activeLoanCount: loans.length,
    totalPrincipalDisbursed: totalPrincipal,
    totalOutstandingApprox: totalOutstanding,
    overdueApprox,
    applicationCounts: {
      draft: applications.filter((a) => a.status === "draft").length,
      submitted: applications.filter((a) => a.status === "submitted").length,
      approved: applications.filter((a) => a.status === "approved").length,
      rejected: applications.filter((a) => a.status === "rejected").length,
    },
  });
}
