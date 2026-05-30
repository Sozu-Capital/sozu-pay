import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getUserBySessionId } from "@/lib/db/users";
import { listAuthPasskeysForUser } from "@/lib/db/auth-passkeys";
import { publicKeyToBase64Url } from "@/lib/stellar/smartAccounts/passkeyPublicKey";

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

  let publicKey65b: string | null = null;
  const raw = primary.public_key?.trim();
  if (raw) {
    try {
      const padded = raw.replace(/-/g, "+").replace(/_/g, "/");
      const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
      const decoded = Buffer.from(padded + pad, "base64");
      if (decoded.length === 65 && decoded[0] === 0x04) {
        publicKey65b = publicKeyToBase64Url(new Uint8Array(decoded));
      }
    } catch {
      // legacy rows may not store 65-byte key
    }
  }

  return NextResponse.json({
    credentialId: primary.credential_id,
    publicKey65b,
    username: user.username ?? null,
  });
}
