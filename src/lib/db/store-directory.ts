import "server-only";

import { parseStandingLink } from "@/lib/dashboard/payment-link";
import { listQRPointsForOrg } from "@/lib/db/merchant-qr-points";
import { getOrganizationById } from "@/lib/db/organizations";
import { getSupabase } from "@/lib/supabase/server";

export type StoreDirectoryItem = {
  slug: string;
  name: string;
  amountUsd: string;
  collectibleReceipt: boolean;
  editionSize: number | null;
};

export type StoreDirectoryCard = {
  id: string;
  name: string;
};

export type StoreDirectoryProfile = StoreDirectoryCard & {
  items: StoreDirectoryItem[];
};

function cleanQuery(raw: string): string {
  return raw.replace(/[%_\\]/g, "").trim().slice(0, 60);
}

export async function searchStoresByName(rawQuery: string): Promise<StoreDirectoryCard[]> {
  const q = cleanQuery(rawQuery);
  if (q.length < 2) return [];

  const { data, error } = await getSupabase()
    .from("organizations")
    .select("id, name")
    .eq("type", "store")
    .ilike("name", `%${q}%`)
    .order("name", { ascending: true })
    .limit(12);

  if (error) {
    console.error("[store-directory] search error:", error.message);
    return [];
  }

  return (data ?? []).map((row) => ({
    id: row.id as string,
    name: row.name as string,
  }));
}

export async function getStoreProfile(id: string): Promise<StoreDirectoryProfile | null> {
  const org = await getOrganizationById(id);
  if (!org || org.type !== "store") return null;

  const points = await listQRPointsForOrg(org.id);
  const items: StoreDirectoryItem[] = [];
  for (const point of points) {
    if (!point.isOnline || point.destinationType !== "checkout") continue;
    const offer = parseStandingLink(point.destinationRef);
    if (!offer) continue;
    items.push({
      slug: point.slug,
      name: point.name,
      amountUsd: offer.amountUsd,
      collectibleReceipt: offer.collectibleReceipt,
      editionSize: offer.editionSize,
    });
  }
  items.sort((a, b) => a.name.localeCompare(b.name));

  return { id: org.id, name: org.name, items };
}
