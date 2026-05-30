import { NextRequest, NextResponse } from "next/server";
import { challengeStore } from "@/lib/webauthn/config";
import { establishSessionForUser } from "@/lib/auth/establish-session";
import { resolvePostAuthRedirect } from "@/lib/auth/post-login-redirect";
import { insertAuthPasskey } from "@/lib/db/auth-passkeys";
import { createPasskeyUser, isUsernameAvailable } from "@/lib/db/users";
import { isValidUsername, normalizeUsername } from "@/lib/webauthn/utils";

export async function POST(request: NextRequest) {
  try {
    const { username: raw, credential, challenge: providedChallenge, returnTo } =
      await request.json();

    if (!raw || !credential?.id) {
      return NextResponse.json({ error: "Invalid registration payload" }, { status: 400 });
    }

    const username = normalizeUsername(raw);
    if (!isValidUsername(username)) {
      return NextResponse.json({ error: "Invalid username" }, { status: 400 });
    }

    const stored = challengeStore.get(username);
    if (stored) challengeStore.delete(username);
    else if (!providedChallenge) {
      return NextResponse.json({ error: "Challenge expired" }, { status: 400 });
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

    const publicKey =
      credential.response?.publicKey ||
      credential.response?.attestationObject ||
      credential.id;

    const passkey = await insertAuthPasskey({
      userId: user.id,
      credentialId: credential.id,
      publicKey: typeof publicKey === "string" ? publicKey : credential.id,
      transports: credential.response?.transports,
    });

    if (!passkey) {
      return NextResponse.json({ error: "Failed to store passkey" }, { status: 500 });
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
    console.error("[register/verify]", e);
    return NextResponse.json({ error: "Failed to verify registration" }, { status: 500 });
  }
}
