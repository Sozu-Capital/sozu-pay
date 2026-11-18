import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getUserBySessionId } from "@/lib/db/users";
import {
  findAuthPasskeyByCredentialId,
  insertAuthPasskey,
} from "@/lib/db/auth-passkeys";

/**
 * Attach a passkey to the signed-in account so the next visit can use it to sign in.
 * Pollar accounts have no passkey until this runs.
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = await getUserBySessionId(session.id);
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    credentialId?: unknown;
    publicKey?: unknown;
  };
  const credentialId = typeof body.credentialId === "string" ? body.credentialId.trim() : "";
  const publicKey = typeof body.publicKey === "string" ? body.publicKey.trim() : "";
  if (!credentialId) {
    return NextResponse.json({ error: "Passkey id is required." }, { status: 400 });
  }

  const existing = await findAuthPasskeyByCredentialId(credentialId);
  if (existing) {
    if (existing.user_id !== user.id) {
      return NextResponse.json({ error: "That passkey belongs to another account." }, { status: 409 });
    }
    return NextResponse.json({ ok: true, alreadySaved: true });
  }

  const saved = await insertAuthPasskey({
    userId: user.id,
    credentialId,
    publicKey: publicKey || credentialId,
  });
  if (!saved) {
    return NextResponse.json({ error: "Could not save the passkey." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, alreadySaved: false });
}
