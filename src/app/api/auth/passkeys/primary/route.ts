import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getUserBySessionId } from "@/lib/db/users";
import { listAuthPasskeysForUser } from "@/lib/db/auth-passkeys";
import { parseAuthPasskeyPublicKey65 } from "@/lib/auth/parse-auth-passkey-public-key";

/**
 * GET /api/auth/passkeys/primary — login passkey for linking smart account (same credential as sign-in).
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

  const passkeys = await listAuthPasskeysForUser(user.id);
  const primary = passkeys[0];
  if (!primary) {
    return NextResponse.json({ error: "No passkey on this account." }, { status: 404 });
  }

  const publicKey65b = parseAuthPasskeyPublicKey65(primary.public_key);

  return NextResponse.json({
    credentialId: primary.credential_id,
    publicKey65b,
    username: user.username ?? null,
  });
}
