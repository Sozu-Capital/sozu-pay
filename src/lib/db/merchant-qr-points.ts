import type { QrPointDestinationType } from "@/lib/dashboard/merchant-qr";
import { getSupabase } from "@/lib/supabase/server";

export type QRPointDestinationType = QrPointDestinationType;
export type QRPointChannel = "qr" | "nfc";

export interface MerchantQRPoint {
  id: string;
  orgId: string;
  name: string;
  slug: string;
  pointType: QRPointChannel;
  destinationType: QRPointDestinationType;
  destinationRef: string | null;
  isOnline: boolean;
  createdAt: string;
  updatedAt: string;
}

function fromDb(row: Record<string, unknown>): MerchantQRPoint {
  const rawType = row.point_type as string | undefined;
  const pointType: QRPointChannel = rawType === "nfc" ? "nfc" : "qr";
  return {
    id: row.id as string,
    orgId: row.org_id as string,
    name: row.name as string,
    slug: row.slug as string,
    pointType,
    destinationType: row.destination_type as QRPointDestinationType,
    destinationRef: (row.destination_ref as string) ?? null,
    isOnline: row.is_online as boolean,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export async function createQRPoint(params: {
  orgId: string;
  name: string;
  slug: string;
  pointType?: QRPointChannel;
  destinationType: QRPointDestinationType;
  destinationRef?: string;
  isOnline?: boolean;
}): Promise<MerchantQRPoint> {
  const now = new Date().toISOString();
  const { data, error } = await getSupabase()
    .from("merchant_qr_points")
    .insert({
      org_id: params.orgId,
      name: params.name,
      slug: params.slug,
      point_type: params.pointType ?? "qr",
      destination_type: params.destinationType,
      destination_ref: params.destinationRef ?? null,
      is_online: params.isOnline ?? true,
      created_at: now,
      updated_at: now,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return fromDb(data);
}

export async function listQRPointsForOrg(orgId: string): Promise<MerchantQRPoint[]> {
  const { data, error } = await getSupabase()
    .from("merchant_qr_points")
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[qr-points] list error:", error.message);
    return [];
  }
  return (data ?? []).map(fromDb);
}

export async function getQRPointBySlug(slug: string): Promise<MerchantQRPoint | null> {
  const { data, error } = await getSupabase()
    .from("merchant_qr_points")
    .select("*")
    .eq("slug", slug.toLowerCase())
    .maybeSingle();

  if (error) {
    console.error("[qr-points] getBySlug error:", error.message);
    return null;
  }
  return data ? fromDb(data) : null;
}

/** Point all dynamic checkout QR/NFC tags at the latest live payment link. */
export async function syncLiveCheckoutForOrg(
  orgId: string,
  checkoutSessionId: string,
): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await getSupabase()
    .from("merchant_qr_points")
    .update({
      destination_ref: checkoutSessionId,
      destination_type: "checkout",
      updated_at: now,
    })
    .eq("org_id", orgId)
    .eq("destination_type", "checkout");

  if (error) {
    console.error("[qr-points] syncLiveCheckoutForOrg error:", error.message);
  }
}

export async function getQRPoint(id: string, orgId: string): Promise<MerchantQRPoint | null> {
  const { data, error } = await getSupabase()
    .from("merchant_qr_points")
    .select("*")
    .eq("id", id)
    .eq("org_id", orgId)
    .maybeSingle();

  if (error) {
    console.error("[qr-points] get error:", error.message);
    return null;
  }
  return data ? fromDb(data) : null;
}

export async function updateQRPoint(
  id: string,
  orgId: string,
  updates: {
    name?: string;
    destinationType?: QRPointDestinationType;
    destinationRef?: string;
    isOnline?: boolean;
  }
): Promise<MerchantQRPoint | null> {
  const payload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (updates.name !== undefined) payload.name = updates.name;
  if (updates.destinationType !== undefined) payload.destination_type = updates.destinationType;
  if (updates.destinationRef !== undefined) payload.destination_ref = updates.destinationRef || null;
  if (updates.isOnline !== undefined) payload.is_online = updates.isOnline;

  const { data, error } = await getSupabase()
    .from("merchant_qr_points")
    .update(payload)
    .eq("id", id)
    .eq("org_id", orgId)
    .select()
    .maybeSingle();

  if (error) {
    console.error("[qr-points] update error:", error.message);
    return null;
  }
  return data ? fromDb(data) : null;
}

export async function deleteQRPoint(id: string, orgId: string): Promise<boolean> {
  const { error } = await getSupabase()
    .from("merchant_qr_points")
    .delete()
    .eq("id", id)
    .eq("org_id", orgId);

  if (error) {
    console.error("[qr-points] delete error:", error.message);
    return false;
  }
  return true;
}
