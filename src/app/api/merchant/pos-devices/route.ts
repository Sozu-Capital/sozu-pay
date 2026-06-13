import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getUserBySessionId } from "@/lib/db/users";
import { createPOSDevice, listPOSDevicesForOrg } from "@/lib/db/merchant-pos-devices";

/**
 * GET /api/merchant/pos-devices
 * List all POS devices for the merchant organization
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await getUserBySessionId(session.id);
  const orgId = session.orgId ?? user?.org_id ?? null;
  if (!orgId) {
    return NextResponse.json({ error: "No organization" }, { status: 403 });
  }

  const devices = await listPOSDevicesForOrg(orgId);
  return NextResponse.json({ devices });
}

/**
 * POST /api/merchant/pos-devices
 * Create a new POS device
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await getUserBySessionId(session.id);
  const orgId = session.orgId ?? user?.org_id ?? null;
  if (!orgId) {
    return NextResponse.json({ error: "No organization" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const deviceType = body.deviceType === "pos" || body.deviceType === "nfc" ? body.deviceType : null;
  const destinationType = body.destinationType === "checkout" || body.destinationType === "custom_url"
    ? body.destinationType
    : null;
  const destinationRef = typeof body.destinationRef === "string" ? body.destinationRef.trim() : undefined;
  const isOnline = typeof body.isOnline === "boolean" ? body.isOnline : true;
  const notes = typeof body.notes === "string" ? body.notes.trim() : undefined;

  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  if (!deviceType) {
    return NextResponse.json({ error: "Invalid device type" }, { status: 400 });
  }
  if (!destinationType) {
    return NextResponse.json({ error: "Invalid destination type" }, { status: 400 });
  }

  try {
    const device = await createPOSDevice({
      orgId,
      name,
      deviceType,
      destinationType,
      destinationRef,
      isOnline,
      notes,
    });
    return NextResponse.json({ device });
  } catch (err) {
    console.error("[pos-devices] create error:", err);
    return NextResponse.json({ error: "Failed to create device" }, { status: 500 });
  }
}
