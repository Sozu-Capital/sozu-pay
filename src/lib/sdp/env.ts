import "server-only";

export type SdpEnvConfig = {
  apiUrl: string;
  adminEmail: string;
  adminPassword: string;
  tenantName: string;
};

/** Bracket access so Vercel/runtime env is read when the function runs, not at build time. */
function readEnv(name: string): string {
  const v = process.env[name];
  return typeof v === "string" ? v.trim() : "";
}

function firstNonEmpty(...keys: string[]): string {
  for (const key of keys) {
    const v = readEnv(key);
    if (v) return v;
  }
  return "";
}

export function getSdpEnv(): SdpEnvConfig {
  return {
    apiUrl: firstNonEmpty("SDP_API_URL", "SDP_ADMIN_URL"),
    adminEmail: firstNonEmpty("SDP_ADMIN_EMAIL", "SDP_OWNER_EMAIL"),
    adminPassword: firstNonEmpty("SDP_ADMIN_PASSWORD", "SDP_OWNER_PASSWORD"),
    tenantName: firstNonEmpty("SDP_TENANT_NAME") || "mujeres-admin",
  };
}

export function isSdpConfigured(): boolean {
  const { apiUrl, adminEmail, adminPassword } = getSdpEnv();
  return !!(apiUrl && adminEmail && adminPassword);
}

export function getSdpConfigStatus(): {
  configured: boolean;
  hasApiUrl: boolean;
  hasAdminEmail: boolean;
  hasAdminPassword: boolean;
  tenantName: string;
} {
  const env = getSdpEnv();
  return {
    configured: !!(env.apiUrl && env.adminEmail && env.adminPassword),
    hasApiUrl: !!env.apiUrl,
    hasAdminEmail: !!env.adminEmail,
    hasAdminPassword: !!env.adminPassword,
    tenantName: env.tenantName,
  };
}

export function sdpNotConfiguredMessage(): string {
  const s = getSdpConfigStatus();
  const missing: string[] = [];
  if (!s.hasApiUrl) missing.push("SDP_API_URL");
  if (!s.hasAdminEmail) missing.push("SDP_ADMIN_EMAIL");
  if (!s.hasAdminPassword) missing.push("SDP_ADMIN_PASSWORD");
  if (missing.length === 0) {
    return "SDP_API_URL, SDP_ADMIN_EMAIL, or SDP_ADMIN_PASSWORD not configured";
  }
  return `SDP not configured (missing at runtime: ${missing.join(", ")}). Set them on Vercel and redeploy.`;
}
