/**
 * Sends SDP recipient invite emails via Resend.
 * Mirrors the pattern used in credit-notifications.ts.
 */

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM =
  process.env.SDP_INVITE_EMAIL_FROM ??
  process.env.CREDIT_EMAIL_FROM ??
  "Sozu Credit <invites@resend.dev>";

/** Sozu black + orange card tokens (matches SozuCredit SDP / wallet UI). */
const EMAIL_THEME = {
  pageBg: "#0a0a0a",
  cardBg: "#111111",
  cardBorder: "rgba(251, 146, 60, 0.35)",
  cardRadius: "16px",
  textPrimary: "#fef3e7",
  textMuted: "rgba(254, 243, 231, 0.65)",
  textDim: "rgba(254, 243, 231, 0.45)",
  orange: "#f97316",
  orangeSoft: "rgba(249, 115, 22, 0.15)",
  orangeBorder: "rgba(251, 146, 60, 0.35)",
  orangeText: "#fdba74",
} as const;

export interface SdpInviteEmailParams {
  toEmail: string;
  /** Beneficiary display name from batch CSV */
  recipientName?: string;
  organizationName: string;
  /** Distribution campaign / batch name */
  campaignName?: string;
  registrationUrl: string;
  amountUsdc?: string;
}

export interface SdpInviteEmailResult {
  sent: boolean;
  skipped: boolean;
  error?: string;
  messageId?: string;
}

function salutation(recipientName?: string): string {
  const trimmed = recipientName?.trim();
  return trimmed ? `${trimmed},` : "Hola,";
}

function buildSubject(params: SdpInviteEmailParams): string {
  const org = params.organizationName.trim();
  if (params.recipientName?.trim()) {
    return `${params.recipientName.trim()}, ${org} tiene un pago para vos`;
  }
  return `${org} tiene un pago para vos`;
}

function buildPlainText(params: SdpInviteEmailParams): string {
  const org = params.organizationName;
  const greet = salutation(params.recipientName);

  const amountLine = params.amountUsdc
    ? `\nMonto: ${params.amountUsdc} USDC\n`
    : "";

  const campaignLine = params.campaignName?.trim()
    ? `Campaña de distribución: ${params.campaignName.trim()}\n`
    : "";

  return `${greet}

${org} te envió un pago.${amountLine}
Organización: ${org}
${campaignLine}
Para recibirlo, registrá tu billetera con este enlace:

${params.registrationUrl}

Cuando termines el registro, el pago se acreditará en tu billetera.

Este enlace es personal — no lo compartas.

¿Dudas? Respondé este correo o escribile a ${org}.
`;
}

function buildHtml(params: SdpInviteEmailParams): string {
  const org = escHtml(params.organizationName);
  const greet = escHtml(salutation(params.recipientName));

  const amountBlock = params.amountUsdc
    ? `<p style="margin:0 0 20px;font-size:28px;font-weight:700;color:${EMAIL_THEME.orange};line-height:1.2">${escHtml(params.amountUsdc)} USDC</p>`
    : "";

  const metaRows: string[] = [];
  metaRows.push(metaRow("Organización", params.organizationName.trim()));
  if (params.campaignName?.trim()) {
    metaRows.push(metaRow("Campaña de distribución", params.campaignName.trim()));
  }

  const metaBlock =
    metaRows.length > 0
      ? `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 24px;border-collapse:collapse">
  ${metaRows.join("\n  ")}
</table>`
      : "";

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${org} tiene un pago para vos</title>
</head>
<body style="margin:0;padding:0;background:${EMAIL_THEME.pageBg};font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:${EMAIL_THEME.pageBg};border-collapse:collapse">
    <tr>
      <td align="center" style="padding:32px 16px">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:560px;border-collapse:separate;border-spacing:0;background:${EMAIL_THEME.cardBg};border:1px solid ${EMAIL_THEME.cardBorder};border-radius:${EMAIL_THEME.cardRadius};overflow:hidden">
          <tr>
            <td style="padding:28px 28px 8px">
              <p style="margin:0 0 8px;font-size:12px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:${EMAIL_THEME.orangeText}">${org}</p>
              <h1 style="margin:0;font-size:24px;font-weight:700;line-height:1.3;color:${EMAIL_THEME.textPrimary}">${greet}</h1>
              <p style="margin:12px 0 0;font-size:16px;line-height:1.55;color:${EMAIL_THEME.textMuted}"><strong style="color:${EMAIL_THEME.textPrimary}">${org}</strong> te envió un pago.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 28px 0">
              ${amountBlock}
              ${metaBlock}
            </td>
          </tr>
          <tr>
            <td style="padding:8px 28px 28px">
              <p style="margin:0 0 16px;font-size:15px;line-height:1.55;color:${EMAIL_THEME.textMuted}">Para recibirlo, registrá tu billetera:</p>
              <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:separate">
                <tr>
                  <td align="center" style="border-radius:12px;background:${EMAIL_THEME.orangeSoft};border:1px solid ${EMAIL_THEME.orangeBorder}">
                    <a href="${escHtml(params.registrationUrl)}"
                       style="display:inline-block;padding:14px 24px;font-size:15px;font-weight:600;color:${EMAIL_THEME.orangeText};text-decoration:none">
                      Registrar billetera y recibir pago
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:24px 0 0;font-size:13px;line-height:1.5;color:${EMAIL_THEME.textDim}">
                Este enlace es personal — no lo compartas.<br>
                ¿Dudas? Respondé este correo o escribile a ${org}.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function metaRow(label: string, value: string): string {
  return `<tr>
    <td style="padding:6px 0;border-bottom:1px solid rgba(251,146,60,0.12)">
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse">
        <tr>
          <td style="font-size:12px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:${EMAIL_THEME.textDim};width:96px;vertical-align:top">${escHtml(label)}</td>
          <td style="font-size:14px;color:${EMAIL_THEME.textPrimary};vertical-align:top">${escHtml(value)}</td>
        </tr>
      </table>
    </td>
  </tr>`;
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

  const subject = buildSubject(params);
  const text = buildPlainText(params);
  const html = buildHtml(params);

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
