import { NextRequest, NextResponse } from "next/server";
import { verifyRecoveryPin, isValidPinFormat } from "@/lib/auth/pin-crypto";
import { establishSessionForUser } from "@/lib/auth/establish-session";
import { resolvePostAuthRedirect } from "@/lib/auth/post-login-redirect";
import { getUserByUsername } from "@/lib/db/users";
import { normalizeUsername } from "@/lib/webauthn/utils";

export async function POST(request: NextRequest) {
  try {
    const { username: raw, pin, returnTo } = await request.json();
    if (!raw || !pin || typeof pin !== "string") {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    const username = normalizeUsername(raw);
    if (!isValidPinFormat(pin)) {
      return NextResponse.json({ error: "Invalid PIN" }, { status: 400 });
    }

    const user = await getUserByUsername(username);
    if (!user?.recovery_pin_hash) {
      return NextResponse.json(
        {
          error: "pin_not_configured",
          message: "No backup PIN. Sign in with your passkey, then set a PIN in Settings.",
        },
        { status: 400 }
      );
    }

    if (!verifyRecoveryPin(pin, user.recovery_pin_hash)) {
      return NextResponse.json({ error: "Could not sign in" }, { status: 401 });
    }

    await establishSessionForUser(user);
    const redirect = await resolvePostAuthRedirect(
      user,
      typeof returnTo === "string" ? returnTo : undefined
    );

    return NextResponse.json({
      success: true,
      userId: user.id,
      username: user.username,
      redirect,
    });
  } catch (e) {
    console.error("[pin/login]", e);
    return NextResponse.json({ error: "Could not sign in" }, { status: 500 });
  }
}
