import { NextRequest, NextResponse } from "next/server";
import { isUsernameAvailable, getUserByUsername } from "@/lib/db/users";
import { isOrgSozuTagAvailable } from "@/lib/org-sozu-tag";
import { isValidUsername, normalizeUsername } from "@/lib/webauthn/utils";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const raw = body?.username;
    const scope = body?.scope === "org" ? "org" : "passkey";
    if (!raw || typeof raw !== "string") {
      return NextResponse.json({ error: "Username required" }, { status: 400 });
    }
    if (scope === "org") {
      const orgCheck = await isOrgSozuTagAvailable(raw);
      return NextResponse.json({
        available: orgCheck.available,
        error: orgCheck.error,
        scope: "org",
      });
    }
    const username = normalizeUsername(raw);
    if (!isValidUsername(username)) {
      return NextResponse.json({ available: false, error: "Invalid format" });
    }
    const available = await isUsernameAvailable(username);
    const user = available ? null : await getUserByUsername(username);
    return NextResponse.json({
      available,
      pinSet: !!user?.recovery_pin_hash,
      scope: "passkey",
    });
  } catch (e) {
    console.error("[username/check]", e);
    return NextResponse.json({ error: "Check failed" }, { status: 500 });
  }
}
