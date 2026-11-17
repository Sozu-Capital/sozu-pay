import { getSupabase } from "@/lib/supabase/server";
import { canonicalWriteDecision, isSmartAccountContractId } from "@/lib/payment/canonical-smart-account";

export type SmartAccountType = "org_treasury" | "member";

export type SmartAccountRow = {
  id: string;
  org_id: string;
  user_id: number | null;
  type: SmartAccountType;
  contract_id: string;
  created_at: string;
};

export async function upsertSmartAccount(params: {
  orgId: string;
  userId?: number | null;
  type: SmartAccountType;
  contractId: string;
}): Promise<SmartAccountRow | null> {
  const sb = getSupabase();
  let existingQuery = sb
    .from("smart_accounts")
    .select("*")
    .eq("org_id", params.orgId)
    .eq("type", params.type)
    .limit(1);
  existingQuery = params.userId
    ? existingQuery.eq("user_id", params.userId)
    : existingQuery.is("user_id", null);
  const { data: existing } = await existingQuery.maybeSingle();
  if (existing && isSmartAccountContractId((existing as SmartAccountRow).contract_id)) {
    const decision = canonicalWriteDecision(
      (existing as SmartAccountRow).contract_id,
      params.contractId,
    );
    if (decision.action !== "write") {
      if (decision.action === "reject") {
        console.warn("[smart-accounts] refused to replace canonical contract", {
          orgId: params.orgId,
          type: params.type,
          canonical: decision.contractId,
        });
      }
      return existing as SmartAccountRow;
    }
  }

  const { data, error } = await sb
    .from("smart_accounts")
    .upsert(
      {
        org_id: params.orgId,
        user_id: params.userId ?? null,
        type: params.type,
        contract_id: params.contractId,
      },
      { onConflict: params.userId ? "org_id,user_id,type" : "org_id,type" }
    )
    .select()
    .single();

  if (error) {
    console.error("[smart-accounts] upsert error:", error.message);
    return null;
  }
  return data as SmartAccountRow;
}

export async function getMemberSmartAccount(
  orgId: string,
  userId: number
): Promise<SmartAccountRow | null> {
  const { data, error } = await getSupabase()
    .from("smart_accounts")
    .select("*")
    .eq("org_id", orgId)
    .eq("user_id", userId)
    .eq("type", "member")
    .limit(1)
    .maybeSingle();
  if (error) return null;
  return (data as SmartAccountRow) ?? null;
}

export async function getOrgTreasurySmartAccount(
  orgId: string
): Promise<SmartAccountRow | null> {
  const { data, error } = await getSupabase()
    .from("smart_accounts")
    .select("*")
    .eq("org_id", orgId)
    .eq("type", "org_treasury")
    .limit(1)
    .maybeSingle();
  if (error) return null;
  return (data as SmartAccountRow) ?? null;
}

