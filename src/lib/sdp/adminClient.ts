/**
 * SDP tenant admin client — server-only.
 *
 * Authenticates as the NGO operator user against the hosted SDP instance on
 * Railway and provides typed wrappers for the disbursement lifecycle.
 *
 * Auth flow: POST /auth/login → JWT stored in module-level cache (process
 * memory; short-lived, re-authenticated on 401). Never exposed to the browser.
 */

const SDP_API_URL = process.env.SDP_API_URL ?? "";
const SDP_ADMIN_EMAIL = process.env.SDP_ADMIN_EMAIL ?? "";
const SDP_ADMIN_PASSWORD = process.env.SDP_ADMIN_PASSWORD ?? "";
// Tenant name header required on every request in SDP v6 multi-tenant mode.
// Defaults to "mujeres-admin" (the tenant created during Railway setup).
const SDP_TENANT_NAME = process.env.SDP_TENANT_NAME ?? "mujeres-admin";

// In-memory token cache (per-process; sufficient for a serverless warm instance).
let _token: string | null = null;
let _tokenExpiry = 0;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SdpDisbursement {
  id: string;
  name: string;
  status: string;
  total_payments: number;
  successful_payments: number;
  failed_payments: number;
  cancelled_payments: number;
  remaining_payments: number;
  total_amount: string;
  disbursed_amount: string;
  asset: { code: string; issuer: string };
  wallet: { id: string; name: string };
  created_at: string;
  updated_at: string;
}

export interface SdpPayment {
  id: string;
  amount: string;
  status: string;
  stellar_transaction_id: string | null;
  receiver: { id: string; email?: string; phone_number?: string };
  created_at: string;
  updated_at: string;
}

/**
 * ReceiverWallet as returned inside GET /disbursements/{id}/receivers.
 * SDP v6 embeds the wallet AND payment directly on each receiver row.
 */
export interface SdpReceiverWallet {
  id: string;
  status: string;
  stellar_address?: string;
  invited_at?: string | null;
  last_message_sent_at?: string | null;
  invitation_sent_at?: string | null;
}

/**
 * Payment embedded in each DisbursementReceiver row.
 * SDP v6 has no /disbursements/{id}/payments route; payments are accessed
 * via GET /disbursements/{id}/receivers → [].payment.
 */
export interface SdpEmbeddedPayment {
  id: string;
  amount: string;
  status: string;
  stellar_transaction_id?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface SdpReceiver {
  id: string;
  email?: string;
  phone_number?: string;
  external_id?: string;
  /** Embedded payment for this disbursement (present on disbursement-scoped receiver lists). */
  payment?: SdpEmbeddedPayment | null;
  /** Wallet registration state for this receiver. */
  receiver_wallet?: SdpReceiverWallet | null;
}

export interface CreateDisbursementParams {
  name: string;
  walletId: string;
  /** UUID returned by GET /assets — required by SDP v6. */
  assetId: string;
  /** Defaults to EMAIL (invite by email). */
  registrationContactType?: "EMAIL" | "PHONE_NUMBER" | "EMAIL_AND_WALLET_ADDRESS" | "PHONE_NUMBER_AND_WALLET_ADDRESS";
  countryCode?: string;
  verificationField?: string;
}

export interface RegisterWalletParams {
  name: string;
  homepage: string;
  sep10ClientDomain: string;
  deepLinkSchema: string;
  assets: Array<{ code: string; issuer: string }>;
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function sdpUrl(path: string): string {
  return `${SDP_API_URL.replace(/\/$/, "")}${path}`;
}

async function authenticate(): Promise<string> {
  const now = Date.now();
  if (_token && now < _tokenExpiry) return _token;

  const res = await fetch(sdpUrl("/login"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "SDP-Tenant-Name": SDP_TENANT_NAME,
    },
    body: JSON.stringify({ email: SDP_ADMIN_EMAIL, password: SDP_ADMIN_PASSWORD }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`SDP auth failed (${res.status}): ${text}`);
  }

  const data = (await res.json()) as { token: string; refresh_token?: string };
  _token = data.token;
  // Treat token as valid for 55 minutes (SDP default is 1 h).
  _tokenExpiry = now + 55 * 60 * 1000;
  return _token;
}

async function sdpFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await authenticate();
  const res = await fetch(sdpUrl(path), {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "SDP-Tenant-Name": SDP_TENANT_NAME,
      ...options.headers,
    },
  });

  if (res.status === 401) {
    // Token expired mid-request — clear cache and retry once.
    _token = null;
    _tokenExpiry = 0;
    return sdpFetch<T>(path, options);
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`SDP ${options.method ?? "GET"} ${path} → ${res.status}: ${text}`);
  }

  const ct = res.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) return res.json() as Promise<T>;
  return undefined as unknown as T;
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Verify connectivity and auth. Returns SDP health info. */
export async function sdpHealth(): Promise<unknown> {
  return sdpFetch<unknown>("/health");
}

/** List all available wallets registered in SDP (to pick walletId).
 *  SDP v6 GET /wallets returns a raw JSON array, not a wrapped object. */
export async function listWallets(): Promise<Array<{ id: string; name: string; homepage: string; sep_10_client_domain?: string }>> {
  const data = await sdpFetch<Array<{ id: string; name: string; homepage: string; sep_10_client_domain?: string }>>("/wallets");
  return Array.isArray(data) ? data : [];
}

/** Register a new wallet in SDP (tenant admin or super-admin required). */
export async function registerWallet(
  params: RegisterWalletParams
): Promise<{ id: string; name: string; homepage: string }> {
  return sdpFetch<{ id: string; name: string; homepage: string }>("/wallets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: params.name,
      homepage: params.homepage,
      sep_10_client_domain: params.sep10ClientDomain,
      deep_link_schema: params.deepLinkSchema,
      assets: params.assets,
    }),
  });
}

/**
 * Ensures the SozuCredit wallet is registered in SDP.
 * Returns the wallet ID (existing or newly created).
 * Reads SOZUCREDIT_URL from the environment; falls back gracefully if already present.
 */
export async function ensureSozuCreditWallet(
  assets: Array<{ code: string; issuer: string }>
): Promise<string | null> {
  const walletUrl = (process.env.SOZUCREDIT_URL ?? "").replace(/\/$/, "");
  if (!walletUrl) return null;

  const clientDomain = walletUrl.replace(/^https?:\/\//i, "").split("/")[0];
  const deepLinkSchema = `${walletUrl}/sdp/invite`;

  try {
    const wallets = await listWallets();
    const existing = wallets.find(
      (w) =>
        w.sep_10_client_domain === clientDomain ||
        w.homepage?.replace(/\/$/, "") === walletUrl
    );
    if (existing) return existing.id;

    const created = await registerWallet({
      name: "SozuCredit",
      homepage: walletUrl,
      sep10ClientDomain: clientDomain,
      deepLinkSchema,
      assets,
    });
    return created.id;
  } catch (e) {
    console.warn("[ensureSozuCreditWallet] Could not register wallet:", e instanceof Error ? e.message : e);
    return null;
  }
}

/** List all available assets registered in SDP.
 *  SDP v6 GET /assets returns a raw JSON array, not a wrapped object. */
export async function listAssets(): Promise<Array<{ id: string; code: string; issuer: string }>> {
  const data = await sdpFetch<Array<{ id: string; code: string; issuer: string }>>("/assets");
  return Array.isArray(data) ? data : [];
}

/** Create a new disbursement batch. Returns the created disbursement. */
export async function createDisbursement(
  params: CreateDisbursementParams
): Promise<SdpDisbursement> {
  return sdpFetch<SdpDisbursement>("/disbursements", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: params.name,
      wallet_id: params.walletId,
      asset_id: params.assetId,
      registration_contact_type: params.registrationContactType ?? "EMAIL",
      country_code: params.countryCode ?? "US",
      verification_field: params.verificationField ?? "DATE_OF_BIRTH",
    }),
  });
}

/**
 * Upload the CSV payment instructions for a disbursement.
 * The CSV must have columns matching SDP's expected format:
 *   email,id,amount,verification  (or phone instead of email)
 */
export async function uploadInstructions(
  disbursementId: string,
  csvBuffer: Buffer,
  fileName = "disbursement.csv"
): Promise<void> {
  const token = await authenticate();
  const formData = new FormData();
  const blob = new Blob([new Uint8Array(csvBuffer)], { type: "text/csv" });
  formData.append("file", blob, fileName);

  const res = await fetch(sdpUrl(`/disbursements/${disbursementId}/instructions`), {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "SDP-Tenant-Name": SDP_TENANT_NAME },
    body: formData,
  });

  if (res.status === 401) {
    _token = null;
    _tokenExpiry = 0;
    return uploadInstructions(disbursementId, csvBuffer, fileName);
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`SDP upload instructions → ${res.status}: ${text}`);
  }
}

/** Start (or approve) a disbursement so payments begin processing. */
export async function startDisbursement(disbursementId: string): Promise<void> {
  await sdpFetch<void>(`/disbursements/${disbursementId}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "STARTED" }),
  });
}

/** Pause a disbursement (reversible). */
export async function pauseDisbursement(disbursementId: string): Promise<void> {
  await sdpFetch<void>(`/disbursements/${disbursementId}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "PAUSED" }),
  });
}

/** Get a single disbursement by ID. */
export async function getDisbursement(disbursementId: string): Promise<SdpDisbursement> {
  return sdpFetch<SdpDisbursement>(`/disbursements/${disbursementId}`);
}

/** List all disbursements (paginated; returns first 100 by default). */
export async function listDisbursements(): Promise<SdpDisbursement[]> {
  const data = await sdpFetch<{ data: SdpDisbursement[] }>("/disbursements?page=1&page_limit=100");
  return data.data ?? [];
}

/**
 * List receivers for a disbursement.
 * SDP v6 GET /disbursements/{id}/receivers returns paginated receivers,
 * each with an embedded `payment` and `receiver_wallet` object.
 * This is the ONLY way to get per-payment detail for a disbursement —
 * there is no /disbursements/{id}/payments sub-route in SDP v6.
 */
export async function listReceivers(disbursementId: string): Promise<SdpReceiver[]> {
  const data = await sdpFetch<{ data: SdpReceiver[] }>(
    `/disbursements/${disbursementId}/receivers?page=1&page_limit=100`
  );
  return data.data ?? [];
}

/**
 * Trigger SDP to (re)send a signed wallet-registration invite to a receiver.
 * SDP v6 route: PATCH /receivers/{receiver_id}/wallets/{receiver_wallet_id}
 *
 * SDP generates a cryptographically-signed deep link and delivers it
 * via its configured message channel (email / SMS). This is the only
 * supported way to get a signed registration URL to a recipient — the
 * dashboard cannot sign URLs itself.
 */
export async function retryReceiverWalletInvitation(
  receiverId: string,
  receiverWalletId: string
): Promise<void> {
  await sdpFetch<void>(`/receivers/${receiverId}/wallets/${receiverWalletId}`, {
    method: "PATCH",
  });
}
