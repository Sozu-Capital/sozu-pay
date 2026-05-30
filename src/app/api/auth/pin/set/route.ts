import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { hashRecoveryPin, isValidPinFormat } from "@/lib/auth/pin-crypto";
import { getUserBySessionId, setUserRecoveryPinHash } from "@/lib/db/users";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { pin } = await request.json();
    if (!pin || typeof pin !== "string" || !isValidPinFormat(pin)) {
      return NextResponse.json(
        { error: "PIN must be 6–12 digits" },
        { status: 400 }
      );
    }

    const user = await getUserBySessionId(session.id);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const updated = await setUserRecoveryPinHash(user.id, hashRecoveryPin(pin));
    if (!updated) {
      return NextResponse.json({ error: "Failed to save PIN" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[pin/set]", e);
    return NextResponse.json({ error: "Failed to save PIN" }, { status: 500 });
  }
}
