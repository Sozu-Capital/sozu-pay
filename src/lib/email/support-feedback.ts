/** Merchant sidebar feedback is delivered to Sozu support. */

export const SUPPORT_EMAIL = "support@sozu.capital";
export const FEEDBACK_MAX_LENGTH = 2000;

export type SupportFeedbackDraft = {
  message: string;
  fromEmail: string;
  orgName: string | null;
  orgId: string | null;
  path: string | null;
};

export type SupportFeedbackMail = {
  to: string;
  replyTo?: string;
  subject: string;
  text: string;
};

export function normalizeFeedbackMessage(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const message = raw.trim();
  if (!message || message.length > FEEDBACK_MAX_LENGTH) return null;
  return message;
}

export function normalizeFeedbackPath(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const path = raw.trim();
  if (!path.startsWith("/") || path.length > 200) return null;
  if (/[\r\n]/.test(path)) return null;
  return path;
}

/** Real merchant inbox. Skip the passkey placeholder so support can reply. */
export function feedbackReplyTo(email: string): string | undefined {
  const trimmed = email.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return undefined;
  if (trimmed.toLowerCase().endsWith("@passkey.sozupay")) return undefined;
  return trimmed;
}

function oneLine(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim();
}

export function buildSupportFeedbackMail(draft: SupportFeedbackDraft): SupportFeedbackMail {
  const who = oneLine(draft.orgName || draft.fromEmail || "Sozu Pay");
  const replyTo = feedbackReplyTo(draft.fromEmail);
  const lines = [
    `From: ${oneLine(draft.fromEmail) || "unknown"}`,
    draft.orgName ? `Store: ${oneLine(draft.orgName)}` : null,
    draft.orgId ? `Org: ${oneLine(draft.orgId)}` : null,
    draft.path ? `Page: ${draft.path}` : null,
    "",
    draft.message,
  ].filter((line): line is string => line !== null);

  return {
    to: SUPPORT_EMAIL,
    ...(replyTo ? { replyTo } : {}),
    subject: `Sozu Pay feedback — ${who}`.slice(0, 180),
    text: lines.join("\n"),
  };
}

export async function sendSupportFeedback(
  draft: SupportFeedbackDraft,
): Promise<{ sent: boolean; error?: string }> {
  const mail = buildSupportFeedbackMail(draft);
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[feedback] RESEND_API_KEY not set; feedback was not emailed");
    return { sent: false, error: "no_resend_key" };
  }

  const from =
    process.env.FEEDBACK_EMAIL_FROM ??
    process.env.CREDIT_EMAIL_FROM ??
    "Sozu Pay <notifications@resend.dev>";

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [mail.to],
        ...(mail.replyTo ? { reply_to: mail.replyTo } : {}),
        subject: mail.subject,
        text: mail.text,
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      console.error("[feedback] resend error:", errText);
      return { sent: false, error: "resend_failed" };
    }
    return { sent: true };
  } catch (e) {
    console.error("[feedback] send failed:", e);
    return { sent: false, error: "resend_failed" };
  }
}
