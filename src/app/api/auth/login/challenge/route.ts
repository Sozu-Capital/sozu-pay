import { NextRequest, NextResponse } from "next/server";
import { challengeStore, cleanupChallenges } from "@/lib/webauthn/config";
import { generateChallenge, normalizeUsername } from "@/lib/webauthn/utils";
import { getUserByUsername } from "@/lib/db/users";
import { listAuthPasskeysForUser } from "@/lib/db/auth-passkeys";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const rawUsername = body?.username;
    cleanupChallenges();
    const challenge = generateChallenge();

    if (rawUsername && typeof rawUsername === "string" && rawUsername.trim()) {
      const username = normalizeUsername(rawUsername);
      const user = await getUserByUsername(username);
      if (user) {
        const passkeys = await listAuthPasskeysForUser(user.id);
        if (passkeys.length > 0) {
          challengeStore.set(username, { challenge, timestamp: Date.now() });
          return NextResponse.json({
            challenge,
            allowCredentials: passkeys.map((pk) => ({
              id: pk.credential_id,
              type: "public-key",
              transports: pk.transports ?? undefined,
            })),
            timeout: 60000,
            userVerification: "required",
          });
        }
      }
    }

    challengeStore.set("__discovery__", { challenge, timestamp: Date.now() });
    return NextResponse.json({
      challenge,
      timeout: 60000,
      userVerification: "required",
    });
  } catch (e) {
    console.error("[login/challenge]", e);
    return NextResponse.json({ error: "Failed to generate challenge" }, { status: 500 });
  }
}
