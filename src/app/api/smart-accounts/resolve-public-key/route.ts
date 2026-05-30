import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { parseAuthPasskeyPublicKey65 } from "@/lib/auth/parse-auth-passkey-public-key";
import { findAuthPasskeyByCredentialId, listAuthPasskeysForUser } from "@/lib/db/auth-passkeys";
import { getUserBySessionId } from "@/lib/db/users";
import { resolveOnChainPasskeyPublicKey } from "@/lib/stellar/smartAccounts/resolveOnChainPublicKey";
import { normalizeCredentialId } from "@/lib/webauthn/utils";

/**
 * GET /api/smart-accounts/resolve-public-key?contractId=&credentialId=
 * Resolves passkey public key from on-chain smart account or login passkey row.
 */
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const contractId = request.nextUrl.searchParams.get("contractId")?.trim() ?? "";
  const credentialId = request.nextUrl.searchParams.get("credentialId")?.trim() ?? "";

  if (!contractId || !credentialId) {
    return NextResponse.json(
      { error: "contractId and credentialId are required." },
      { status: 400 }
    );
  }

  let publicKey65b = await resolveOnChainPasskeyPublicKey({ contractId, credentialId });

  if (!publicKey65b) {
    const passkey = await findAuthPasskeyByCredentialId(credentialId);
    if (passkey) {
      publicKey65b = parseAuthPasskeyPublicKey65(passkey.public_key);
    }
  }

  if (!publicKey65b) {
    const user = await getUserBySessionId(session.id);
    if (user) {
      const normalized = normalizeCredentialId(credentialId);
      const passkeys = await listAuthPasskeysForUser(user.id);
      const match =
        passkeys.find((p) => normalizeCredentialId(p.credential_id) === normalized) ??
        passkeys[0];
      if (match) {
        publicKey65b = parseAuthPasskeyPublicKey65(match.public_key);
      }
    }
  }

  if (!publicKey65b) {
    return NextResponse.json(
      { error: "Passkey public key not found for this smart account." },
      { status: 404 }
    );
  }

  return NextResponse.json({ publicKey65b });
}
