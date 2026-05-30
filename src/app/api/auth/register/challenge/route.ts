import { NextRequest, NextResponse } from "next/server";
import { challengeStore, cleanupChallenges, getRpID, rpName } from "@/lib/webauthn/config";
import { generateChallenge, isValidUsername, normalizeUsername } from "@/lib/webauthn/utils";
import { isUsernameAvailable } from "@/lib/db/users";

export async function POST(request: NextRequest) {
  try {
    const { username: raw } = await request.json();
    if (!raw || typeof raw !== "string") {
      return NextResponse.json({ error: "Username is required" }, { status: 400 });
    }
    const username = normalizeUsername(raw);
    if (!isValidUsername(username)) {
      return NextResponse.json(
        { error: "Tag must be 3–32 characters (letters, numbers, underscore)." },
        { status: 400 }
      );
    }

    if (!(await isUsernameAvailable(username))) {
      return NextResponse.json(
        { error: "This Sozu tag is already taken.", usernameExists: true },
        { status: 409 }
      );
    }

    cleanupChallenges();
    const challenge = generateChallenge();
    const rpID = getRpID(request);
    challengeStore.set(username, { challenge, timestamp: Date.now() });

    return NextResponse.json({
      challenge,
      rp: { name: rpName, id: rpID },
      user: { id: username, name: username, displayName: username },
      pubKeyCredParams: [
        { alg: -7, type: "public-key" },
        { alg: -257, type: "public-key" },
      ],
      authenticatorSelection: {
        requireResidentKey: true,
        residentKey: "required",
        userVerification: "required",
      },
      timeout: 60000,
      attestation: "none",
    });
  } catch (e) {
    console.error("[register/challenge]", e);
    return NextResponse.json({ error: "Failed to generate challenge" }, { status: 500 });
  }
}
