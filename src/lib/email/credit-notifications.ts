import { hasCreditEmailBeenSent, logCreditEmailSent } from "@/lib/db/credit-email-log";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM =
  process.env.CREDIT_EMAIL_FROM ?? "Sozu Credit <notifications@resend.dev>";

/**
 * Sends review outcome email (approved / rejected). Idempotent per application + kind.
 */
export async function sendCreditReviewEmail(params: {
  applicationId: string;
  toEmail: string;
  applicantName: string;
  organizationName: string;
  outcome: "approved" | "rejected";
  portalUrl: string;
}): Promise<{ sent: boolean; skipped: boolean; error?: string }> {
  const kind = `review_${params.outcome}`;
  if (await hasCreditEmailBeenSent(params.applicationId, kind)) {
    return { sent: false, skipped: true };
  }

  if (!RESEND_API_KEY) {
    console.warn(
      "[credit-email] RESEND_API_KEY not set; skipping transactional email"
    );
    return { sent: false, skipped: true, error: "no_resend_key" };
  }

  const subject =
    params.outcome === "approved"
      ? `Your credit request was approved — ${params.organizationName}`
      : `Update on your credit request — ${params.organizationName}`;

  const text =
    params.outcome === "approved"
      ? `Hi ${params.applicantName},\n\nYour credit request with ${params.organizationName} has been approved.\n\nView details: ${params.portalUrl}\n`
      : `Hi ${params.applicantName},\n\nYour credit request with ${params.organizationName} was not approved at this time.\n\nYou can sign in for more information: ${params.portalUrl}\n`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to: [params.toEmail],
        subject,
        text,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return { sent: false, skipped: false, error: errText };
    }

    await logCreditEmailSent(params.applicationId, kind);
    return { sent: true, skipped: false };
  } catch (e) {
    return {
      sent: false,
      skipped: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
