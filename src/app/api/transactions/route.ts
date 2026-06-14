import { NextRequest, NextResponse } from "next/server";
import { getDashboardWalletContext } from "@/lib/wallet-resolve-cached";
import { getTransactions } from "@/lib/stellar/transactions";
import { getSession } from "@/lib/auth/session";

/**
 * Recent transactions for the organization's disbursement wallet.
 * Dashboard is organization-centric; returns empty list when org has no wallet yet.
 */
export async function GET(request: NextRequest) {
  const { publicKey, disbursementContractId, org } = await getDashboardWalletContext();
  if (!publicKey) {
    const session = await getSession();
    if (session) {
      return NextResponse.json({ transactions: [] });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get("limit")) || 20, 100);

  const additionalHoldersList: string[] = [];
  if (org) {
    if (org.stellar_disbursement_public_key) {
      additionalHoldersList.push(org.stellar_disbursement_public_key);
    }
    if (org.soroban_contract_id) {
      additionalHoldersList.push(org.soroban_contract_id);
    }
    if (org.treasury_contract_id) {
      additionalHoldersList.push(org.treasury_contract_id);
    }
    if (org.treasury_smart_account_address) {
      additionalHoldersList.push(org.treasury_smart_account_address);
    }
  }
  if (disbursementContractId) {
    additionalHoldersList.push(disbursementContractId);
  }

  const uniqueHolders = Array.from(new Set(additionalHoldersList))
    .filter((h) => h !== publicKey);

  const list = await getTransactions(publicKey, limit, { additionalHolders: uniqueHolders });
  return NextResponse.json({ transactions: list });
}
