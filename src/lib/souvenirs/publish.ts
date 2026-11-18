import "server-only";

import { getSozuCreditSupabase } from "@/lib/sozucredit/supabase";
import {
  launchedFromUnknown,
  souvenirLaunchHeaders,
  souvenirSlug,
  walletSouvenirOrigin,
  type LaunchedSouvenir,
  type SouvenirLaunchInput,
} from "@/lib/souvenirs/launch";

async function publishViaWallet(input: SouvenirLaunchInput, slug: string): Promise<LaunchedSouvenir | null> {
  const origin = walletSouvenirOrigin();
  const res = await fetch(`${origin}/api/souvenirs/launch`, {
    method: "POST",
    headers: souvenirLaunchHeaders(),
    body: JSON.stringify({ ...input, slug }),
  });
  if (!res.ok) return null;
  const data = (await res.json().catch(() => ({}))) as { souvenir?: unknown };
  return launchedFromUnknown(data.souvenir);
}

async function publishViaWalletDb(input: SouvenirLaunchInput, slug: string): Promise<LaunchedSouvenir | null> {
  const db = getSozuCreditSupabase();
  if (!db) return null;
  const { data, error } = await db
    .from("souvenirs")
    .insert({
      slug,
      title: input.title,
      drop_name: input.merchantName,
      image_url: input.imageUrl,
      merchant_org_id: input.merchantOrgId,
      claim_starts_at: input.claimStartsAt,
      claim_ends_at: input.claimEndsAt,
    })
    .select("slug,title,drop_name,image_url,claim_starts_at,claim_ends_at")
    .maybeSingle();
  if (error || !data) return null;
  return {
    slug: data.slug as string,
    name: data.title as string,
    drop: data.drop_name as string,
    imagePath: data.image_url as string,
    claimStartsAt: data.claim_starts_at as string,
    claimEndsAt: data.claim_ends_at as string,
  };
}

export async function publishMerchantSouvenir(input: SouvenirLaunchInput): Promise<LaunchedSouvenir> {
  const unique = input.merchantOrgId || crypto.randomUUID();
  let lastError = "unavailable";
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const slug = souvenirSlug(input.title, attempt === 0 ? unique : crypto.randomUUID());
    const fromWallet = await publishViaWallet(input, slug).catch(() => null);
    if (fromWallet) return fromWallet;
    const fromDb = await publishViaWalletDb(input, slug).catch(() => null);
    if (fromDb) return fromDb;
    lastError = "unavailable";
  }
  throw new Error(lastError);
}

export async function listMerchantSouvenirs(orgId: string): Promise<LaunchedSouvenir[]> {
  const origin = walletSouvenirOrigin();
  const secret = process.env.SOZU_PAY_SOUVENIR_SECRET?.trim() ?? "";
  if (secret.length >= 16) {
    const res = await fetch(`${origin}/api/souvenirs/launch?orgId=${encodeURIComponent(orgId)}`, {
      headers: souvenirLaunchHeaders(),
      cache: "no-store",
    }).catch(() => null);
    if (res?.ok) {
      const data = (await res.json().catch(() => ({}))) as { souvenirs?: unknown };
      if (Array.isArray(data.souvenirs)) {
        return data.souvenirs.map(launchedFromUnknown).filter((row): row is LaunchedSouvenir => row != null);
      }
    }
  }

  const db = getSozuCreditSupabase();
  if (!db) return [];
  const { data, error } = await db
    .from("souvenirs")
    .select("slug,title,drop_name,image_url,claim_starts_at,claim_ends_at")
    .eq("merchant_org_id", orgId)
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data.map((row) => ({
    slug: row.slug as string,
    name: row.title as string,
    drop: row.drop_name as string,
    imagePath: row.image_url as string,
    claimStartsAt: row.claim_starts_at as string,
    claimEndsAt: row.claim_ends_at as string,
  }));
}
