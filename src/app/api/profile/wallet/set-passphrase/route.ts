import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getUserBySessionId, updateUserPayoutPublicKey } from "@/lib/db/users";
import { deriveKeypairFromPassphrase } from "@/lib/auth/wallet-unlock";

/**
 * POST /api/profile/wallet/set-passphrase
 * Set the payout wallet passphrase (first-time only). Derives keypair and stores only the public key.
 * Body: { passphrase: string, confirmPassphrase: string }
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

  const existingPayoutKey = user.stellar_payout_public_key;
  if (existingPayoutKey) {
    return NextResponse.json(
      { error: "Payout wallet already set. Contact support to change it." },
      { status: 400 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const passphrase = typeof body.passphrase === "string" ? body.passphrase.trim() : "";
  const confirmPassphrase = typeof body.confirmPassphrase === "string" ? body.confirmPassphrase.trim() : "";

  if (!passphrase || passphrase.length < 8) {
    return NextResponse.json(
      { error: "Passphrase must be at least 8 characters" },
      { status: 400 }
    );
  }
  if (passphrase !== confirmPassphrase) {
    return NextResponse.json(
      { error: "Passphrases do not match" },
      { status: 400 }
    );
  }

  try {
    const keypair = deriveKeypairFromPassphrase(passphrase, session.id);
    const publicKey = keypair.publicKey();
    const { user: updated, error: dbError } = await updateUserPayoutPublicKey(session.id, publicKey);
    if (dbError || !updated) {
      const message =
        process.env.NODE_ENV === "development" && dbError
          ? dbError
          : "Failed to save payout wallet";
      return NextResponse.json({ error: message }, { status: 500 });
    }
    return NextResponse.json({
      ok: true,
      publicKey,
      message: "Payout wallet set. Fund this address with USDC to send payouts (super-admin only).",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Key derivation failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
