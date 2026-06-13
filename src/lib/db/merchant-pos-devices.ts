import { getSupabase } from "@/lib/supabase/server";

export type POSDeviceType = "pos" | "nfc";
export type POSDestinationType = "checkout" | "custom_url";

export interface MerchantPOSDevice {
  id: string;
  orgId: string;
  name: string;
  deviceType: POSDeviceType;
  destinationType: POSDestinationType;
  destinationRef: string | null;
  isOnline: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

function fromDb(row: Record<string, unknown>): MerchantPOSDevice {
  return {
    id: row.id as string,
    orgId: row.org_id as string,
    name: row.name as string,
    deviceType: row.device_type as POSDeviceType,
    destinationType: row.destination_type as POSDestinationType,
    destinationRef: (row.destination_ref as string) ?? null,
    isOnline: row.is_online as boolean,
    notes: (row.notes as string) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export async function createPOSDevice(params: {
  orgId: string;
  name: string;
  deviceType: POSDeviceType;
  destinationType: POSDestinationType;
  destinationRef?: string;
  isOnline?: boolean;
  notes?: string;
}): Promise<MerchantPOSDevice> {
  const now = new Date().toISOString();
  const { data, error } = await getSupabase()
    .from("merchant_pos_devices")
    .insert({
      org_id: params.orgId,
      name: params.name,
      device_type: params.deviceType,
      destination_type: params.destinationType,
      destination_ref: params.destinationRef ?? null,
      is_online: params.isOnline ?? true,
      notes: params.notes ?? null,
      created_at: now,
      updated_at: now,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return fromDb(data);
}

export async function listPOSDevicesForOrg(orgId: string): Promise<MerchantPOSDevice[]> {
  const { data, error } = await getSupabase()
    .from("merchant_pos_devices")
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[pos-devices] list error:", error.message);
    return [];
  }
  return (data ?? []).map(fromDb);
}

export async function getPOSDevice(id: string, orgId: string): Promise<MerchantPOSDevice | null> {
  const { data, error } = await getSupabase()
    .from("merchant_pos_devices")
    .select("*")
    .eq("id", id)
    .eq("org_id", orgId)
    .maybeSingle();

  if (error) {
    console.error("[pos-devices] get error:", error.message);
    return null;
  }
  return data ? fromDb(data) : null;
}

export async function updatePOSDevice(
  id: string,
  orgId: string,
  updates: {
    name?: string;
    deviceType?: POSDeviceType;
    destinationType?: POSDestinationType;
    destinationRef?: string;
    isOnline?: boolean;
    notes?: string;
  }
): Promise<MerchantPOSDevice | null> {
  const payload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (updates.name !== undefined) payload.name = updates.name;
  if (updates.deviceType !== undefined) payload.device_type = updates.deviceType;
  if (updates.destinationType !== undefined) payload.destination_type = updates.destinationType;
  if (updates.destinationRef !== undefined) payload.destination_ref = updates.destinationRef || null;
  if (updates.isOnline !== undefined) payload.is_online = updates.isOnline;
  if (updates.notes !== undefined) payload.notes = updates.notes || null;

  const { data, error } = await getSupabase()
    .from("merchant_pos_devices")
    .update(payload)
    .eq("id", id)
    .eq("org_id", orgId)
    .select()
    .maybeSingle();

  if (error) {
    console.error("[pos-devices] update error:", error.message);
    return null;
  }
  return data ? fromDb(data) : null;
}

export async function deletePOSDevice(id: string, orgId: string): Promise<boolean> {
  const { error } = await getSupabase()
    .from("merchant_pos_devices")
    .delete()
    .eq("id", id)
    .eq("org_id", orgId);

  if (error) {
    console.error("[pos-devices] delete error:", error.message);
    return false;
  }
  return true;
}
