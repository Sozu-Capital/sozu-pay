/**
 * Salesforce REST sync — token + upsert helpers.
 * Configure Connected App + env vars; queue processor calls pushSalesforceRecord.
 */

const SF_INSTANCE_URL = process.env.SALESFORCE_INSTANCE_URL?.replace(/\/$/, "");
const SF_CLIENT_ID = process.env.SALESFORCE_CLIENT_ID;
const SF_CLIENT_SECRET = process.env.SALESFORCE_CLIENT_SECRET;
const SF_USERNAME = process.env.SALESFORCE_USERNAME;
const SF_PASSWORD = process.env.SALESFORCE_PASSWORD;
const SF_SECURITY_TOKEN = process.env.SALESFORCE_SECURITY_TOKEN;

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string | null> {
  if (!SF_INSTANCE_URL || !SF_CLIENT_ID || !SF_CLIENT_SECRET || !SF_USERNAME) {
    return null;
  }
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 60_000) {
    return cachedToken.token;
  }

  const pass = `${SF_PASSWORD ?? ""}${SF_SECURITY_TOKEN ?? ""}`;
  const body = new URLSearchParams({
    grant_type: "password",
    client_id: SF_CLIENT_ID,
    client_secret: SF_CLIENT_SECRET,
    username: SF_USERNAME,
    password: pass,
  });

  const res = await fetch(`${SF_INSTANCE_URL}/services/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    console.error("[salesforce] token error", await res.text());
    return null;
  }

  const json = (await res.json()) as {
    access_token: string;
    expires_in: number;
  };
  cachedToken = {
    token: json.access_token,
    expiresAt: now + (json.expires_in ?? 3600) * 1000,
  };
  return cachedToken.token;
}

/**
 * Upserts a generic SObject. `sobject` e.g. Custom_Object__c; `externalIdField` for idempotent upserts.
 */
export async function upsertSalesforceSObject(params: {
  sobject: string;
  externalIdField: string;
  externalId: string;
  fields: Record<string, unknown>;
}): Promise<{ ok: boolean; error?: string }> {
  const token = await getAccessToken();
  if (!token || !SF_INSTANCE_URL) {
    return { ok: false, error: "salesforce_not_configured" };
  }

  const path = `/services/data/v59.0/sobjects/${params.sobject}/${params.externalIdField}/${encodeURIComponent(params.externalId)}`;
  const res = await fetch(`${SF_INSTANCE_URL}${path}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params.fields),
  });

  if (res.ok || res.status === 201 || res.status === 204) {
    return { ok: true };
  }

  const err = await res.text();
  return { ok: false, error: err };
}

/** Default object names — override via env for NGO-specific schema. */
export function getSalesforceCreditApplicationObject(): string {
  return process.env.SALESFORCE_SOBJECT_CREDIT_APP ?? "Sozu_Credit_Application__c";
}
