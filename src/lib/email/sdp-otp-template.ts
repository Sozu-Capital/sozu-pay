import { SOZU_EMAIL_THEME } from "@/lib/email/sozu-email-theme";

/**
 * HTML OTP body for SDP organizations.otp_message_template (Go html/template).
 * Variables: {{.OTP}}, {{.OrganizationName}} — SDP appends a security disclaimer.
 */
export function buildSdpOtpHtmlTemplate(_fallbackOrgName = "Sozu"): string {
  const t = SOZU_EMAIL_THEME;

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="margin:0;padding:0;background:${t.pageBg};font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:${t.pageBg};border-collapse:collapse">
    <tr>
      <td align="center" style="padding:32px 16px">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:420px;border-collapse:separate;border-spacing:0;background:${t.cardBg};border:1px solid ${t.cardBorder};border-radius:${t.cardRadius};overflow:hidden">
          <tr>
            <td style="padding:28px 28px 8px">
              <p style="margin:0 0 8px;font-size:12px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:${t.orangeText}">Sozu Credit</p>
              <h1 style="margin:0;font-size:22px;font-weight:700;line-height:1.3;color:${t.textPrimary}">Tu código de verificación</h1>
              <p style="margin:12px 0 0;font-size:15px;line-height:1.55;color:${t.textMuted}">Usá este código para confirmar tu identidad en <strong style="color:${t.textPrimary}">{{.OrganizationName}}</strong>.</p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:8px 28px 28px">
              <p style="margin:0 0 8px;font-size:13px;color:${t.textDim}">Código (válido por unos minutos)</p>
              <p style="margin:0;font-size:36px;font-weight:700;letter-spacing:0.28em;color:${t.orange};font-variant-numeric:tabular-nums">{{.OTP}}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
