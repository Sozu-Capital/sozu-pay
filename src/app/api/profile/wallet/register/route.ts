import { NextRequest, NextResponse } from "next/server";
import { Keypair } from "@stellar/stellar-sdk";
import { getSession } from "@/lib/auth/session";
import { getUserBySessionId, updateUserStellarPublicKey } from "@/lib/db/users";
import { createSmartAccountForSigner } from "@/lib/stellar/smart-account";

const REGISTRATION_MESSAGE_PREFIX = "SozuPay wallet registration";

/**
 * POST /api/profile/wallet/register
 * Body: { stellar_public_key: string, message: string, signature: string (base64) }
 * Verifies the signature and stores the public key for the current user.
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await getUserBySessionId(session.id);
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (user.stellar_public_key) {
    return NextResponse.json(
      { error: "You already have a wallet registered." },
      { status: 400 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const publicKey =
    typeof body.stellar_public_key === "string" ? body.stellar_public_key.trim() : null;
  const message = typeof body.message === "string" ? body.message : null;
  const signatureB64 = typeof body.signature === "string" ? body.signature : null;

  if (!publicKey || !message || !signatureB64) {
    return NextResponse.json(
      { error: "Missing stellar_public_key, message, or signature" },
      { status: 400 }
    );
  }

  if (!message.startsWith(REGISTRATION_MESSAGE_PREFIX)) {
    return NextResponse.json(
      { error: "Invalid message format" },
      { status: 400 }
    );
  }

  let keypair: Keypair;
  try {
    keypair = Keypair.fromPublicKey(publicKey);
  } catch {
    return NextResponse.json(
      { error: "Invalid Stellar public key" },
      { status: 400 }
    );
  }

  let signatureBuffer: Buffer;
  try {
    signatureBuffer = Buffer.from(signatureB64, "base64");
  } catch {
    return NextResponse.json(
      { error: "Invalid signature encoding" },
      { status: 400 }
    );
  }

  const messageBuffer = Buffer.from(message, "utf8");
  const valid = keypair.verify(messageBuffer, signatureBuffer);
  if (!valid) {
    return NextResponse.json(
      { error: "Signature verification failed" },
      { status: 400 }
    );
  }

  const updated = await updateUserStellarPublicKey(session.id, publicKey);
  if (!updated) {
    return NextResponse.json(
      { error: "Failed to save wallet" },
      { status: 500 }
    );
  }

  let smartAccountAddress: string | null = null;
  try {
    const cAddress = await createSmartAccountForSigner(publicKey);
    if (cAddress) smartAccountAddress = cAddress;
  } catch {
    // Non-fatal: user still has G registered
  }

  return NextResponse.json({
    ok: true,
    stellar_public_key: updated.stellar_public_key,
    stellar_smart_account_address: smartAccountAddress ?? undefined,
  });
}
