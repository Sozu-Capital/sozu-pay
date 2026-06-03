import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getUserBySessionId } from "@/lib/db/users";
import { listAuthPasskeysForUser } from "@/lib/db/auth-passkeys";
import { getMemberSmartAccount } from "@/lib/db/smart-accounts";
import { listWebauthnCredentialsForUser } from "@/lib/db/webauthn-credentials";

export const dynamic = "force-dynamic";

/**
 * GET /api/smart-accounts/signing-context
 * Login passkey + registered member smart account for the current session.
 * Used client-side so Soroban signing targets the same passkey as sign-in, not the latest kit wallet.
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await getUserBySessionId(session.id);
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const [passkeys, memberSa, webauthnCreds] = await Promise.all([
    listAuthPasskeysForUser(user.id),
    user.org_id ? getMemberSmartAccount(user.org_id, user.id) : Promise.resolve(null),
    user.org_id
      ? listWebauthnCredentialsForUser({ userId: user.id, orgId: user.org_id })
      : Promise.resolve([]),
  ]);

  const primary = passkeys[0] ?? null;
  const signingCredentialId =
    webauthnCreds.find((c) => c.credential_id === primary?.credential_id)?.credential_id ??
    webauthnCreds[0]?.credential_id ??
    primary?.credential_id ??
    null;

  return NextResponse.json({
    loginCredentialId: primary?.credential_id ?? null,
    signingCredentialId,
    memberContractId: memberSa?.contract_id ?? null,
    username: user.username ?? null,
    smartWalletReady: Boolean(memberSa),
  });
}
