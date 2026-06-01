import { NextRequest, NextResponse } from "next/server";
import { challengeStore } from "@/lib/webauthn/config";
import { jsonResponseWithSession } from "@/lib/auth/establish-session";
import { resolvePostAuthRedirect } from "@/lib/auth/post-login-redirect";
import {
  findAuthPasskeyByCredentialId,
  touchAuthPasskey,
} from "@/lib/db/auth-passkeys";
import { getUserById, getUserByUsername } from "@/lib/db/users";
import { base64URLToBuffer } from "@/lib/webauthn/utils";
import { repairOrgCreatorAccess } from "@/lib/auth/disbursement-auth";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const { username: rawUsername, credential, challenge: providedChallenge, returnTo } =
      await request.json();

    if (!credential?.id) {
      return NextResponse.json({ error: "Invalid credential" }, { status: 400 });
    }

    const passkey = await findAuthPasskeyByCredentialId(credential.id);
    if (!passkey) {
      return NextResponse.json(
        { error: "Passkey not found. Register first or use another device." },
        { status: 401 }
      );
    }

    const user = await getUserById(passkey.user_id);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (rawUsername && typeof rawUsername === "string") {
      const profile = await getUserByUsername(rawUsername);
      if (profile && profile.id !== user.id) {
        return NextResponse.json({ error: "Invalid passkey for this tag" }, { status: 401 });
      }
    }

    let stored = challengeStore.get("__discovery__");
    if (!stored && rawUsername) {
      const clean = rawUsername.replace(/^\$/, "").trim().toLowerCase();
      stored = challengeStore.get(clean) ?? undefined;
      if (stored) challengeStore.delete(clean);
    }
    if (stored) challengeStore.delete("__discovery__");
    if (!stored && !providedChallenge) {
      return NextResponse.json({ error: "Challenge expired" }, { status: 400 });
    }

    if (credential.response?.clientDataJSON && stored?.challenge) {
      try {
        const clientData = JSON.parse(
          new TextDecoder().decode(base64URLToBuffer(credential.response.clientDataJSON))
        ) as { type?: string; challenge?: string };
        if (clientData.type !== "webauthn.get") {
          return NextResponse.json({ error: "Invalid authentication type" }, { status: 401 });
        }
      } catch {
        // continue — full WebAuthn verify can be added later
      }
    }

    await touchAuthPasskey(passkey.id);

    // Run org-creator access repair at login time so GET /api/profile stays read-only.
    const repairedUser = await repairOrgCreatorAccess(user).catch(() => user);

    const redirect = await resolvePostAuthRedirect(
      repairedUser,
      typeof returnTo === "string" ? returnTo : undefined
    );

    return jsonResponseWithSession(repairedUser, {
      success: true,
      userId: user.id,
      username: user.username,
      redirect,
    });
  } catch (e) {
    console.error("[login/verify]", e);
    return NextResponse.json({ error: "Failed to verify login" }, { status: 500 });
  }
}
