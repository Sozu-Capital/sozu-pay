import "server-only";

const SDP_API_URL = process.env.SDP_API_URL ?? "";
const SDP_TENANT_NAME = process.env.SDP_TENANT_NAME?.trim() ?? "mujeres-admin";

export function getConfiguredSdpTenantName(): string {
  return SDP_TENANT_NAME;
}

/** Probe whether SDP recognizes a tenant name (login rejects bad tenant before password check). */
export async function probeSdpTenantName(tenantName: string): Promise<{
  ok: boolean;
  tenantName: string;
  detail: string;
}> {
  if (!SDP_API_URL) {
    return { ok: false, tenantName, detail: "SDP_API_URL is not configured." };
  }

  const res = await fetch(`${SDP_API_URL.replace(/\/$/, "")}/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "SDP-Tenant-Name": tenantName,
    },
    body: JSON.stringify({ email: "probe@invalid.local", password: "invalid" }),
  });

  const text = await res.text();
  let body: { error?: string; extras?: { details?: string } } = {};
  try {
    body = JSON.parse(text) as typeof body;
  } catch {
    // ignore
  }

  const msg = body.error ?? text.slice(0, 120);
  if (msg.includes("Tenant not found")) {
    return { ok: false, tenantName, detail: msg };
  }
  if (body.extras?.details?.includes("Incorrect email or password")) {
    return { ok: true, tenantName, detail: "Tenant exists (login reached password check)." };
  }

  return { ok: res.ok, tenantName, detail: msg || `HTTP ${res.status}` };
}

/**
 * HEAD/GET wallet-registration/start before redirecting the recipient.
 * Returns an error message when SDP cannot load the tenant (usually missing tenant DB migrations).
 */
export async function preflightWalletRegistrationUrl(
  url: string,
  tenantName?: string
): Promise<string | null> {
  const tenant = tenantName?.trim() || SDP_TENANT_NAME;
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "manual",
      headers: tenant ? { "SDP-Tenant-Name": tenant } : {},
    });
    if (res.status < 400) return null;

    const text = await res.text();
    let error = text.slice(0, 200);
    try {
      const data = JSON.parse(text) as { error?: string };
      if (typeof data.error === "string") error = data.error;
    } catch {
      // ignore
    }

    if (error.includes("Failed to load tenant")) {
      return (
        "SDP tenant database is not fully provisioned. On Railway, run tenant migrations: " +
        "`./stellar-disbursement-platform db migrate up --tenant-id <tenant-uuid>` " +
        "(see docs/04-integrations/sdp-railway-deploy.md Step 7)."
      );
    }

    if (error.includes("Not authorized") || error.includes("Unauthorized")) {
      return null;
    }

    return error;
  } catch (e) {
    return e instanceof Error ? e.message : "Could not reach SDP wallet registration.";
  }
}
