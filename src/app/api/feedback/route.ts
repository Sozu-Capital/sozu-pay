import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getOrganizationById } from "@/lib/db/organizations";
import {
  normalizeFeedbackMessage,
  normalizeFeedbackPath,
  sendSupportFeedback,
} from "@/lib/email/support-feedback";

/**
 * POST /api/feedback
 * Emails the signed-in merchant's note to support@sozu.capital.
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const message = normalizeFeedbackMessage(body.message);
  if (!message) {
    return NextResponse.json({ error: "Write a short note first." }, { status: 400 });
  }

  const orgId = session.orgId ?? null;
  const org = orgId ? await getOrganizationById(orgId) : null;

  const result = await sendSupportFeedback({
    message,
    fromEmail: session.email,
    orgName: org?.name ?? null,
    orgId,
    path: normalizeFeedbackPath(body.path),
  });

  if (!result.sent) {
    return NextResponse.json({ error: "Could not send feedback." }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
