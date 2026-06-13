import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getUserBySessionId } from "@/lib/db/users";
import { createQRPoint, listQRPointsForOrg } from "@/lib/db/merchant-qr-points";

/**
 * GET /api/merchant/qr-points
 * List all QR points for the merchant organization
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

  const qrPoints = await listQRPointsForOrg(orgId);
  return NextResponse.json({ qrPoints });
}

/**
 * POST /api/merchant/qr-points
 * Create a new QR point
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
  const slug = typeof body.slug === "string" ? body.slug.trim().toLowerCase() : "";
  const destinationType = body.destinationType === "checkout" || body.destinationType === "custom_url"
    ? body.destinationType
    : null;
  const destinationRef = typeof body.destinationRef === "string" ? body.destinationRef.trim() : undefined;
  const isOnline = typeof body.isOnline === "boolean" ? body.isOnline : true;
  const pointType = body.pointType === "nfc" ? "nfc" : "qr";

  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  if (!slug || !/^[a-z0-9_-]+$/.test(slug)) {
    return NextResponse.json({ error: "Invalid slug (use lowercase letters, numbers, dash, underscore)" }, { status: 400 });
  }
  if (!destinationType) {
    return NextResponse.json({ error: "Invalid destination type" }, { status: 400 });
  }

  try {
    const qrPoint = await createQRPoint({
      orgId,
      name,
      slug,
      pointType,
      destinationType,
      destinationRef,
      isOnline,
    });
    return NextResponse.json({ qrPoint });
  } catch (err) {
    console.error("[qr-points] create error:", err);
    return NextResponse.json({ error: "Failed to create QR point" }, { status: 500 });
  }
}
