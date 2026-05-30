import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getUserBySessionId } from "@/lib/db/users";
import { getOrganizationForUser } from "@/lib/db/organizations";
import { getMemberSmartAccount } from "@/lib/db/smart-accounts";
import { provisionOrgSmartTreasury } from "@/lib/stellar/provisionOrgSmartTreasury";
import { provisionOrgTestnetClassicDisbursement } from "@/lib/stellar/provisionOrgTestnetDisbursement";
import { isDisbursementSigner } from "@/lib/stellar/org-treasury";

/**
 * POST /api/profile/org/provision-treasury
 * Deploy + initialize org disbursement contract with member passkey smart account as signer.
 * Called after org creation and smart-account registration during onboarding.
 */
export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await getUserBySessionId(session.id);
  if (!user?.org_id) {
    return NextResponse.json({ error: "No organization." }, { status: 400 });
  }
  if (user.admin_level !== "super_admin") {
    return NextResponse.json({ error: "Only org creators can provision treasury." }, { status: 403 });
  }

  const org = await getOrganizationForUser(user.org_id);
  if (!org) return NextResponse.json({ error: "Organization not found." }, { status: 404 });

  if (org.soroban_contract_id?.trim()) {
    const memberSa = await getMemberSmartAccount(user.org_id, user.id);
    return NextResponse.json({
      ok: true,
      soroban_contract_id: org.soroban_contract_id,
      member_smart_account_id: memberSa?.contract_id ?? null,
      already_provisioned: true,
    });
  }

  const memberSa = await getMemberSmartAccount(user.org_id, user.id);
  if (!memberSa) {
    return NextResponse.json(
      {
        error: "Member passkey smart wallet required before treasury provisioning.",
        code: "MEMBER_SMART_WALLET_REQUIRED",
      },
      { status: 403 }
    );
  }

  try {
    const result = await provisionOrgSmartTreasury({
      orgId: user.org_id,
      memberSmartAccountContractId: memberSa.contract_id,
    });

    const signerOk = await isDisbursementSigner(result.soroban_contract_id, memberSa.contract_id);

    let classic_public_key: string | undefined;
    if (!org.stellar_disbursement_public_key?.trim()) {
      try {
        const classic = await provisionOrgTestnetClassicDisbursement(user.org_id);
        if (classic?.publicKey) classic_public_key = classic.publicKey;
      } catch (classicErr) {
        console.warn(
          "[provision-treasury] classic G wallet provision:",
          classicErr instanceof Error ? classicErr.message : classicErr
        );
      }
    } else {
      classic_public_key = org.stellar_disbursement_public_key ?? undefined;
    }

    return NextResponse.json({
      ok: true,
      ...result,
      signer_verified: signerOk,
      classic_public_key,
      fund_usdc_hint:
        "Send testnet USDC to the Soroban disbursement contract (C…) for passkey payouts. Use the classic G address for $tag / wallet-app sends.",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[api/profile/org/provision-treasury]", msg);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
