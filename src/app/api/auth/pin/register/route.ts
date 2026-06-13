import { NextRequest, NextResponse } from "next/server";
import { hashRecoveryPin, isValidPinFormat } from "@/lib/auth/pin-crypto";
import { jsonResponseWithSession } from "@/lib/auth/establish-session";
import { resolvePostAuthRedirect } from "@/lib/auth/post-login-redirect";
import {
  createPasskeyUser,
  isUsernameAvailable,
  setUserRecoveryPinHash,
} from "@/lib/db/users";
import { isValidUsername, normalizeUsername } from "@/lib/webauthn/utils";

export async function POST(request: NextRequest) {
  try {
    const { username: raw, pin, returnTo } = await request.json();
    if (!raw || !pin || typeof pin !== "string") {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const username = normalizeUsername(raw);
    if (!isValidUsername(username)) {
      return NextResponse.json({ error: "Invalid username" }, { status: 400 });
    }
    if (!isValidPinFormat(pin)) {
      return NextResponse.json({ error: "PIN must be 6–12 digits" }, { status: 400 });
    }

    if (!(await isUsernameAvailable(username))) {
      return NextResponse.json(
        { error: "This Sozu tag is already taken.", usernameExists: true },
        { status: 409 }
      );
    }

    let user;
    try {
      user = await createPasskeyUser(username);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (msg === "USERNAME_TAKEN") {
        return NextResponse.json(
          { error: "This Sozu tag is already taken.", usernameExists: true },
          { status: 409 }
        );
      }
      throw e;
    }

    const updated = await setUserRecoveryPinHash(user.id, hashRecoveryPin(pin));
    if (!updated) {
      return NextResponse.json({ error: "Failed to save PIN" }, { status: 500 });
    }

    const redirect = await resolvePostAuthRedirect(
      updated,
      typeof returnTo === "string" ? returnTo : undefined
    );

    return jsonResponseWithSession(updated, {
      success: true,
      userId: updated.id,
      username: updated.username,
      redirect,
    });
  } catch (e) {
    console.error("[pin/register]", e);
    return NextResponse.json({ error: "Registration failed" }, { status: 500 });
  }
}
