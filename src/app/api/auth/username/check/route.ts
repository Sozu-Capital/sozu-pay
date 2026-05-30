import { NextRequest, NextResponse } from "next/server";
import { isUsernameAvailable, getUserByUsername } from "@/lib/db/users";
import { isValidUsername, normalizeUsername } from "@/lib/webauthn/utils";

export async function POST(request: NextRequest) {
  try {
    const { username: raw } = await request.json();
    if (!raw || typeof raw !== "string") {
      return NextResponse.json({ error: "Username required" }, { status: 400 });
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
    });
  } catch (e) {
    console.error("[username/check]", e);
    return NextResponse.json({ error: "Check failed" }, { status: 500 });
  }
}
