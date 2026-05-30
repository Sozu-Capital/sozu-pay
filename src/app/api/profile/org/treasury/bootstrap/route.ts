import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getUserBySessionId } from "@/lib/db/users";
import {
  getOrganizationForUser,
  updateOrganizationSorobanContract,
} from "@/lib/db/organizations";
import { getMemberSmartAccount } from "@/lib/db/smart-accounts";
import {
  initializeDisbursementContract,
  isDisbursementSigner,
} from "@/lib/stellar/org-treasury";

/**
 * POST /api/profile/org/treasury/bootstrap
 * Link + initialize disbursement_wallet with member smart account as authorized signer.
 *
 * Body: { contractId: string } — deploy WASM via Soroban CLI first, or use shared testnet contract.
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await getUserBySessionId(session.id);
  if (!user?.org_id || user.admin_level !== "super_admin") {
    return NextResponse.json({ error: "Only super admins can bootstrap treasury." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const contractId = typeof body.contractId === "string" ? body.contractId.trim() : "";
  if (!contractId.startsWith("C")) {
    return NextResponse.json(
      { error: "contractId (C...) is required. Deploy disbursement_wallet WASM first." },
      { status: 400 }
    );
  }

  const memberSa = await getMemberSmartAccount(user.org_id, user.id);
  if (!memberSa) {
    return NextResponse.json(
      {
        error: "Set up your member passkey smart wallet first.",
        code: "MEMBER_SMART_WALLET_REQUIRED",
        setupUrl: "/onboarding/setup-smart-wallet",
      },
      { status: 403 }
    );
  }

  const org = await getOrganizationForUser(user.org_id);
  if (!org) return NextResponse.json({ error: "Organization not found." }, { status: 404 });

  try {
    const alreadySigner = await isDisbursementSigner(contractId, memberSa.contract_id);
    let initTxHash: string | undefined;
    if (!alreadySigner) {
      initTxHash = await initializeDisbursementContract({
        contractId,
        memberSmartAccountContractId: memberSa.contract_id,
      });
    }

    const updated = await updateOrganizationSorobanContract(user.org_id, contractId);
    if (!updated) {
      return NextResponse.json({ error: "Failed to save contract ID on organization." }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      soroban_contract_id: contractId,
      authorized_signer: memberSa.contract_id,
      initialize_tx_hash: initTxHash ?? null,
      already_initialized: alreadySigner,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[api/profile/org/treasury/bootstrap]", msg);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
