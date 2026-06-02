import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null | undefined;

/** SozuCredit Supabase (credit.sozu.capital) — separate from SozuPay dashboard DB. */
export function getSozuCreditSupabase(): SupabaseClient | null {
  if (_client !== undefined) return _client;

  const url = (
    process.env.SOZUCREDIT_SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SOZUCREDIT_SUPABASE_URL ??
    ""
  ).replace(/\/$/, "");
  const key = process.env.SOZUCREDIT_SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url || !key) {
    _client = null;
    return null;
  }

  _client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _client;
}
