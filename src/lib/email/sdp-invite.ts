/**
 * Sends SDP recipient invite emails via Resend.
 * Mirrors the pattern used in credit-notifications.ts.
 */

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM =
  process.env.SDP_INVITE_EMAIL_FROM ??
  process.env.CREDIT_EMAIL_FROM ??
  "Sozu Credit <invites@resend.dev>";

export interface SdpInviteEmailParams {
  toEmail: string;
  organizationName: string;
  registrationUrl: string;
  disbursementName: string;
  amountUsdc?: string;
}

export interface SdpInviteEmailResult {
  sent: boolean;
  skipped: boolean;
  error?: string;
  messageId?: string;
}

/**
 * Sends a single recipient invite email with the SDP registration link.
 * Does NOT deduplicate — callers should track sent status in their own table
 * or the SDP messages API if needed.
 */
export async function sendSdpInviteEmail(
  params: SdpInviteEmailParams
): Promise<SdpInviteEmailResult> {
  if (!RESEND_API_KEY) {
    console.warn("[sdp-invite] RESEND_API_KEY not set; skipping invite email");
    return { sent: false, skipped: true, error: "no_resend_key" };
  }

  const subject = `You have a payment from ${params.organizationName}`;

  const amountLine = params.amountUsdc
    ? `\nPayment amount: ${params.amountUsdc} USDC\n`
    : "";

  const text = `Hi,

${params.organizationName} has sent you a payment through Sozu Credit.${amountLine}
To receive your funds, you need to register your Sozu wallet using the link below:

${params.registrationUrl}

Once you complete registration, your payment will be processed to your wallet.

This link is personal to you — please do not share it.

Questions? Reply to this email or contact ${params.organizationName} directly.

— The Sozu team
`;

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:sans-serif;max-width:560px;margin:auto;padding:24px;color:#1a1a1a">
  <h2 style="color:#0f172a">You have a payment from ${escHtml(params.organizationName)}</h2>
  ${
    params.amountUsdc
      ? `<p style="font-size:20px;font-weight:700;color:#0ea5e9">${escHtml(params.amountUsdc)} USDC</p>`
      : ""
  }
  <p>${escHtml(params.organizationName)} has sent you a payment via <strong>Sozu Credit</strong>.</p>
  <p>To receive your funds, register your Sozu wallet:</p>
  <a href="${escHtml(params.registrationUrl)}"
     style="display:inline-block;padding:12px 24px;background:#0ea5e9;color:#fff;border-radius:6px;text-decoration:none;font-weight:600;margin:16px 0">
    Register &amp; claim your payment
  </a>
  <p style="font-size:13px;color:#64748b;margin-top:32px">
    This link is personal — do not share it.<br>
    Disbursement: ${escHtml(params.disbursementName)}
  </p>
</body>
</html>`;

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
        html,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return { sent: false, skipped: false, error: errText };
    }

    const json = (await res.json()) as { id?: string };
    return { sent: true, skipped: false, messageId: json.id };
  } catch (e) {
    return {
      sent: false,
      skipped: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

function escHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
