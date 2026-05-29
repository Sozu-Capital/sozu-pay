import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getUserByPrivyId } from "@/lib/db/users";
import { addWebauthnCredential } from "@/lib/db/webauthn-credentials";
import { upsertSmartAccount, type SmartAccountType } from "@/lib/db/smart-accounts";
import { updateOrganizationTreasuryContract } from "@/lib/db/organizations";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await getUserByPrivyId(session.id);
  if (!user?.org_id) {
    return NextResponse.json({ error: "No organization selected." }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const typeRaw = typeof body.type === "string" ? body.type : "";
  const type: SmartAccountType =
    typeRaw === "org_treasury" || typeRaw === "member" ? typeRaw : "member";

  if (type === "org_treasury" && user.admin_level !== "super_admin") {
    return NextResponse.json(
      { error: "Only super admins can register the org treasury smart account." },
      { status: 403 }
    );
  }

  const contractId = typeof body.contractId === "string" ? body.contractId.trim() : "";
  const credentialId = typeof body.credentialId === "string" ? body.credentialId.trim() : "";
  const publicKey65b = typeof body.publicKey65b === "string" ? body.publicKey65b.trim() : "";
  const label = typeof body.label === "string" ? body.label.trim() : null;

  if (!contractId || !credentialId || !publicKey65b) {
    return NextResponse.json(
      { error: "contractId, credentialId, and publicKey65b are required." },
      { status: 400 }
    );
  }

  const cred = await addWebauthnCredential({
    userId: user.id,
    orgId: user.org_id,
    credentialId,
    publicKey65b,
    label,
  });
  if (!cred) {
    return NextResponse.json({ error: "Failed to store credential." }, { status: 500 });
  }

  const smart = await upsertSmartAccount({
    orgId: user.org_id,
    userId: type === "member" ? user.id : null,
    type,
    contractId,
  });
  if (!smart) {
    return NextResponse.json({ error: "Failed to store smart account." }, { status: 500 });
  }

  if (type === "org_treasury") {
    await updateOrganizationTreasuryContract(user.org_id, contractId);
  }

  return NextResponse.json({ ok: true, smartAccount: smart });
}

