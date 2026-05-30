import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { Keypair } from "@stellar/stellar-sdk";
import { getSession } from "@/lib/auth/session";
import { getUserBySessionId } from "@/lib/db/users";
import {
  deriveKeypairFromPassphrase,
  setUnlockedKey,
  buildUnlockCookieValue,
  UNLOCK_COOKIE_NAME,
  getExpectedPayoutPublicKey,
} from "@/lib/auth/wallet-unlock";

/**
 * POST /api/auth/unlock-wallet
 * Super-admin only. Body: { passphrase: string } OR { secretKey: string }.
 * - passphrase: derives key (must match stellar_payout_public_key if set).
 * - secretKey: use your registered wallet's secret; must match stellar_public_key or stellar_payout_public_key.
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await getUserBySessionId(session.id);
  if (!user || user.admin_level !== "super_admin") {
    return NextResponse.json(
      { error: "Only super admins can unlock the payout wallet." },
      { status: 403 }
    );
  }

  const expectedPayout = getExpectedPayoutPublicKey(user);
  if (!expectedPayout) {
    return NextResponse.json(
      { error: "Set up a payout wallet first (Profile: create wallet or set passphrase)." },
      { status: 400 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const passphrase = typeof body.passphrase === "string" ? body.passphrase.trim() : "";
  const secretKeyInput = typeof body.secretKey === "string" ? body.secretKey.trim() : "";

  let secretKey: string;
  let publicKey: string;

  if (secretKeyInput) {
    try {
      const keypair = Keypair.fromSecret(secretKeyInput);
      publicKey = keypair.publicKey();
      if (publicKey !== user.stellar_public_key && publicKey !== user.stellar_payout_public_key) {
        return NextResponse.json(
          {
            error: "This secret key does not match your profile wallet. Use the secret for the wallet shown on Profile.",
            expectedPayout,
          },
          { status: 400 }
        );
      }
      secretKey = keypair.secret();
    } catch {
      return NextResponse.json(
        { error: "Invalid secret key." },
        { status: 400 }
      );
    }
  } else if (passphrase) {
    try {
      const keypair = deriveKeypairFromPassphrase(passphrase, session.id);
      publicKey = keypair.publicKey();
      if (user.stellar_payout_public_key && user.stellar_payout_public_key !== publicKey) {
        return NextResponse.json(
          { error: "Wrong passphrase. This does not match the payout wallet you set at signup." },
          { status: 400 }
        );
      }
      secretKey = keypair.secret();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Key derivation failed";
      return NextResponse.json({ error: msg }, { status: 400 });
    }
  } else {
    return NextResponse.json(
      { error: "Send passphrase or secretKey to unlock the payout wallet." },
      { status: 400 }
    );
  }

  setUnlockedKey(session.id, secretKey);
  const cookieStore = await cookies();
  cookieStore.set(UNLOCK_COOKIE_NAME, buildUnlockCookieValue(secretKey), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 15 * 60, // 15 min
    path: "/",
  });
  return NextResponse.json({
    ok: true,
    publicKey,
  });
}
