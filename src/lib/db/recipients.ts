import { getSupabase } from "@/lib/supabase/server";

export interface DbRecipient {
  id: string;
  owner_id: string;
  name: string;
  bank_account_id: string;
  stellar_address: string | null;
  phone: string | null;
  date_of_birth: string | null;
  created_at: string;
}

export interface Recipient {
  id: string;
  userId: string;
  name: string;
  bankAccountId: string;
  stellarAddress?: string;
  phone?: string;
  dateOfBirth?: string;
  createdAt: string;
}

function toRecipient(row: DbRecipient): Recipient {
  return {
    id: row.id,
    userId: row.owner_id,
    name: row.name,
    bankAccountId: row.bank_account_id ?? "",
    stellarAddress: row.stellar_address ?? undefined,
    phone: row.phone ?? undefined,
    dateOfBirth: row.date_of_birth ?? undefined,
    createdAt: row.created_at,
  };
}

export async function createRecipientDb(
  ownerId: string,
  name: string,
  bankAccountId: string,
  stellarAddress?: string,
  phone?: string,
  dateOfBirth?: string
): Promise<Recipient> {
  const payload: Record<string, unknown> = {
    owner_id: ownerId,
    name,
    bank_account_id: bankAccountId ?? "",
    stellar_address: stellarAddress ?? null,
    phone: phone?.trim() || null,
    date_of_birth: dateOfBirth?.trim() || null,
  };
  const { data, error } = await getSupabase()
    .from("recipients")
    .insert(payload)
    .select()
    .single();

  if (error) throw new Error(`Failed to create recipient: ${error.message}`);
  return toRecipient(data as DbRecipient);
}

export async function getRecipientDb(
  id: string,
  ownerId: string
): Promise<Recipient | null> {
  const { data, error } = await getSupabase()
    .from("recipients")
    .select("*")
    .eq("id", id)
    .eq("owner_id", ownerId)
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`Failed to get recipient: ${error.message}`);
  return data ? toRecipient(data as DbRecipient) : null;
}

export async function listRecipientsDb(ownerId: string): Promise<Recipient[]> {
  const { data, error } = await getSupabase()
    .from("recipients")
    .select("*")
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Failed to list recipients: ${error.message}`);
  return ((data ?? []) as DbRecipient[]).map(toRecipient);
}

export async function updateRecipientDb(
  id: string,
  ownerId: string,
  updates: Partial<Pick<Recipient, "name" | "bankAccountId" | "stellarAddress" | "phone" | "dateOfBirth">>
): Promise<Recipient | null> {
  const payload: Record<string, unknown> = {};
  if (updates.name !== undefined) payload.name = updates.name;
  if (updates.bankAccountId !== undefined)
    payload.bank_account_id = updates.bankAccountId;
  if (updates.stellarAddress !== undefined)
    payload.stellar_address = updates.stellarAddress;
  if (updates.phone !== undefined) payload.phone = updates.phone?.trim() || null;
  if (updates.dateOfBirth !== undefined)
    payload.date_of_birth = updates.dateOfBirth?.trim() || null;

  if (Object.keys(payload).length === 0) {
    return getRecipientDb(id, ownerId);
  }

  const { data, error } = await getSupabase()
    .from("recipients")
    .update(payload)
    .eq("id", id)
    .eq("owner_id", ownerId)
    .select()
    .single();

  if (error) throw new Error(`Failed to update recipient: ${error.message}`);
  return data ? toRecipient(data as DbRecipient) : null;
}

export async function deleteRecipientDb(
  id: string,
  ownerId: string
): Promise<boolean> {
  const { error } = await getSupabase()
    .from("recipients")
    .delete()
    .eq("id", id)
    .eq("owner_id", ownerId);

  if (error) throw new Error(`Failed to delete recipient: ${error.message}`);
  return true;
}
