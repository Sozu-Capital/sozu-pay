/** Sozu black + orange email tokens (matches SozuCredit / batch invite emails). */
export const SOZU_EMAIL_THEME = {
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

export function escHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
