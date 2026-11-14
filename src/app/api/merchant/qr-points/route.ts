import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getUserBySessionId } from "@/lib/db/users";
import { allocateQrSlug, createQRPoint, listQRPointsForOrg } from "@/lib/db/merchant-qr-points";
import { normalizeUsdAmount, standingPriceRef } from "@/lib/dashboard/payment-link";
import { listSubmittedPizzaRedeemsForOrg } from "@/lib/db/pizza-redeems";
import { getLatestPendingCheckoutForOrg } from "@/lib/db/checkout-sessions";
import {
  destinationRefForQrCreate,
  parseQrPointDestinationType,
} from "@/lib/dashboard/merchant-qr";
import { foldSubmittedPizzaDeposits } from "@/lib/pizza/deposits";

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
  const deposits = foldSubmittedPizzaDeposits(await listSubmittedPizzaRedeemsForOrg(orgId));
  return NextResponse.json({
    qrPoints: qrPoints.map((point) => ({
      ...point,
      pizzasDeposited: deposits.byQrPointId[point.id] ?? 0,
    })),
    orgPizzasDeposited: deposits.orgTotal,
  });
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
  const requestedSlug = typeof body.slug === "string" ? body.slug.trim().toLowerCase() : "";
  const amountUsd = normalizeUsdAmount(body.amountUsd);
  const destinationType = amountUsd
    ? "checkout"
    : parseQrPointDestinationType(body.destinationType);
  const destinationRef = typeof body.destinationRef === "string" ? body.destinationRef.trim() : undefined;
  const isOnline = typeof body.isOnline === "boolean" ? body.isOnline : true;
  const pointType = body.pointType === "nfc" ? "nfc" : "qr";

  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  if (!amountUsd && body.amountUsd != null && body.amountUsd !== "") {
    return NextResponse.json({ error: "Enter a price greater than 0" }, { status: 400 });
  }
  if (!destinationType) {
    return NextResponse.json({ error: "Invalid destination type" }, { status: 400 });
  }

  try {
    const slug =
      requestedSlug && /^[a-z0-9_-]+$/.test(requestedSlug)
        ? requestedSlug
        : await allocateQrSlug(name);
    if (!/^[a-z0-9_-]+$/.test(slug)) {
      return NextResponse.json({ error: "Invalid slug" }, { status: 400 });
    }

    let finalDestinationRef: string | undefined;
    if (amountUsd) {
      finalDestinationRef = standingPriceRef(amountUsd);
    } else {
      const latest =
        destinationType === "checkout"
          ? await getLatestPendingCheckoutForOrg(orgId)
          : null;
      finalDestinationRef = destinationRefForQrCreate({
        destinationType,
        destinationRef,
        latestCheckoutId: latest?.id ?? null,
      });
    }

    const qrPoint = await createQRPoint({
      orgId,
      name,
      slug,
      pointType,
      destinationType,
      destinationRef: finalDestinationRef,
      isOnline,
    });
    return NextResponse.json({ qrPoint });
  } catch (err) {
    console.error("[qr-points] create error:", err);
    return NextResponse.json({ error: "Failed to create QR point" }, { status: 500 });
  }
}
