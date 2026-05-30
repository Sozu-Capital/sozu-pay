import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getUserBySessionId } from "@/lib/db/users";
import { getOrganizationForUser } from "@/lib/db/organizations";
import { getMemberSmartAccount, getOrgTreasurySmartAccount } from "@/lib/db/smart-accounts";
import { orgTreasuryMigrationStatus } from "@/lib/stellar/org-treasury";

/** GET /api/profile/org/treasury — migration status for super-admin. */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await getUserBySessionId(session.id);
  if (!user?.org_id) {
    return NextResponse.json({ error: "No organization." }, { status: 400 });
  }
  if (user.admin_level !== "super_admin" && user.admin_level !== "admin") {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const org = await getOrganizationForUser(user.org_id);
  if (!org) return NextResponse.json({ error: "Organization not found." }, { status: 404 });

  const memberSa = await getMemberSmartAccount(user.org_id, user.id);
  const treasurySa = await getOrgTreasurySmartAccount(user.org_id);
  const status = orgTreasuryMigrationStatus(org);

  return NextResponse.json({
    org: {
      id: org.id,
      name: org.name,
      classic_public_key: org.stellar_disbursement_public_key,
      soroban_contract_id: org.soroban_contract_id,
      treasury_contract_id: org.treasury_contract_id,
    },
    member_smart_account: memberSa
      ? { contract_id: memberSa.contract_id }
      : null,
    org_treasury_smart_account: treasurySa
      ? { contract_id: treasurySa.contract_id }
      : null,
    migration: status,
    next_steps: buildNextSteps(status, !!memberSa),
  });
}

function buildNextSteps(
  status: ReturnType<typeof orgTreasuryMigrationStatus>,
  hasMemberSa: boolean
): string[] {
  const steps: string[] = [];
  if (!hasMemberSa) {
    steps.push("setup_member_passkey");
  }
  if (!status.hasDisbursementContract) {
    steps.push("bootstrap_disbursement_contract");
  }
  if (status.hasClassicWallet && status.hasDisbursementContract) {
    steps.push("migrate_usdc_from_classic");
  }
  if (status.readyForPasskeyPayouts) {
    steps.push("ready_for_passkey_payouts");
  }
  return steps;
}
