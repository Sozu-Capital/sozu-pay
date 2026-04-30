import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/api-auth";
import {
  listLoansForUser,
  listInstallmentsForLoan,
  sumRepaymentsForLoan,
} from "@/lib/db/credit-agreements";

export async function GET() {
  const su = await getSessionUser();
  if (!su) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const loans = await listLoansForUser(su.user.id);
  const enriched = await Promise.all(
    loans.map(async (loan) => {
      const installments = await listInstallmentsForLoan(loan.id);
      const paid = await sumRepaymentsForLoan(loan.id);
      const totalDue = installments.reduce((s, i) => s + Number(i.total_due), 0);
      const outstanding = Math.max(0, totalDue - paid);
      const next = installments.find((i) => i.status !== "paid");
      return {
        loan,
        installments,
        paidTotal: paid,
        outstandingPrincipalApprox: outstanding,
        nextDue: next
          ? { date: next.due_date, amount: next.total_due }
          : null,
      };
    })
  );

  return NextResponse.json({ loans: enriched });
}
