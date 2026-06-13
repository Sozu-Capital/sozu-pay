import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getUserBySessionId } from "@/lib/db/users";
import { updateQRPoint, deleteQRPoint, getQRPoint } from "@/lib/db/merchant-qr-points";

type Params = {
  params: Promise<{
    id: string;
  }>;
};

/**
 * PATCH /api/merchant/qr-points/[id]
 * Update a QR point
 */
export async function PATCH(request: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const user = await getUserBySessionId(session.id);
  const orgId = session.orgId ?? user?.org_id ?? null;
  if (!orgId) {
    return NextResponse.json({ error: "No organization" }, { status: 403 });
  }

  const existing = await getQRPoint(id, orgId);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const updates: {
    name?: string;
    destinationType?: "checkout" | "custom_url";
    destinationRef?: string;
    isOnline?: boolean;
  } = {};

  if (typeof body.name === "string") {
    updates.name = body.name.trim();
  }
  if (body.destinationType === "checkout" || body.destinationType === "custom_url") {
    updates.destinationType = body.destinationType;
  }
  if (typeof body.destinationRef === "string") {
    updates.destinationRef = body.destinationRef.trim();
  }
  if (typeof body.isOnline === "boolean") {
    updates.isOnline = body.isOnline;
  }

  const updated = await updateQRPoint(id, orgId, updates);
  if (!updated) {
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }

  return NextResponse.json({ qrPoint: updated });
}

/**
 * DELETE /api/merchant/qr-points/[id]
 * Delete a QR point
 */
export async function DELETE(request: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const user = await getUserBySessionId(session.id);
  const orgId = session.orgId ?? user?.org_id ?? null;
  if (!orgId) {
    return NextResponse.json({ error: "No organization" }, { status: 403 });
  }

  const existing = await getQRPoint(id, orgId);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const success = await deleteQRPoint(id, orgId);
  if (!success) {
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
