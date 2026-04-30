import { NextResponse } from "next/server";
import { getSessionUser, isOrgStaff } from "@/lib/auth/api-auth";
import {
  approveCreditApplication,
  rejectCreditApplication,
} from "@/lib/credit/workflow";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const su = await getSessionUser();
  if (!su || !isOrgStaff(su.user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const orgId = su.user.org_id;
  if (!orgId) {
    return NextResponse.json({ error: "No organization" }, { status: 400 });
  }

  const { id } = await ctx.params;
  const body = (await req.json()) as {
    action?: "approve" | "reject";
    rejectionReason?: string | null;
    internalNotes?: string | null;
  };

  if (body.action === "approve") {
    try {
      const { loan } = await approveCreditApplication({
        applicationId: id,
        organizationId: orgId,
        reviewerPrivyId: su.session.id,
        reviewerUserId: su.user.id,
        internalNotes: body.internalNotes ?? null,
      });
      return NextResponse.json({ ok: true, loanId: loan.id });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Approval failed";
      return NextResponse.json({ error: msg }, { status: 400 });
    }
  }

  if (body.action === "reject") {
    try {
      const app = await rejectCreditApplication({
        applicationId: id,
        organizationId: orgId,
        reviewerUserId: su.user.id,
        rejectionReason: body.rejectionReason ?? null,
        internalNotes: body.internalNotes ?? null,
      });
      return NextResponse.json({ ok: true, application: app });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Rejection failed";
      return NextResponse.json({ error: msg }, { status: 400 });
    }
  }

  return NextResponse.json({ error: "action must be approve or reject" }, { status: 400 });
}
