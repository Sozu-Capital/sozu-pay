import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getUserBySessionId } from "@/lib/db/users";
import { allocateQrSlug, createQRPoint, getQRPointByOrgAndSlug, listQRPointsForOrg } from "@/lib/db/merchant-qr-points";
import { ensureOrganizationSlug, getOrganizationById } from "@/lib/db/organizations";
import {
  normalizeUsdAmount,
  parsePaymentLinkProductKind,
  resolveCollectibleReceipt,
  standingPriceRef,
} from "@/lib/dashboard/payment-link";
import { normalizeEditionSize } from "@/lib/dashboard/collectible-edition";
import { parseProductImageDataUrl } from "@/lib/dashboard/product-image";
import { getLatestPendingCheckoutForOrg } from "@/lib/db/checkout-sessions";
import {
  destinationRefForQrCreate,
  parseQrPointDestinationType,
} from "@/lib/dashboard/merchant-qr";

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
  const org = await getOrganizationById(orgId);
  const storeSlug = org ? await ensureOrganizationSlug(org) : orgId;
  return NextResponse.json({ qrPoints, storeSlug });
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
  let imageUrl: string | null = null;
  if (body.imageUrl != null && body.imageUrl !== "") {
    try {
      imageUrl = parseProductImageDataUrl(body.imageUrl);
    } catch (err) {
      const code = err instanceof Error ? err.message : "INVALID_PRODUCT_IMAGE";
      return NextResponse.json(
        {
          error:
            code === "PRODUCT_IMAGE_TOO_LARGE"
              ? "That image is too large. Try a smaller photo."
              : "Use a JPEG, PNG, or WebP image.",
          code,
        },
        { status: 400 },
      );
    }
  }
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
        : await allocateQrSlug(orgId, name);
    if (!/^[a-z0-9_-]+$/.test(slug)) {
      return NextResponse.json({ error: "Invalid slug" }, { status: 400 });
    }
    if (await getQRPointByOrgAndSlug(orgId, slug)) {
      return NextResponse.json({ error: "That link name is already used in this store" }, { status: 409 });
    }

    let finalDestinationRef: string | undefined;
    if (amountUsd) {
      const productKind = parsePaymentLinkProductKind(body.productKind);
      const collectibleReceipt = resolveCollectibleReceipt(
        productKind,
        body.collectibleReceipt === true,
      );
      const editionProvided = body.editionSize != null && body.editionSize !== "";
      const editionSize = normalizeEditionSize(body.editionSize);
      if (collectibleReceipt && editionProvided && editionSize == null) {
        return NextResponse.json(
          { error: "Edition size must be a whole number from 1 to 10000" },
          { status: 400 },
        );
      }
      finalDestinationRef = standingPriceRef(amountUsd, {
        productKind,
        collectibleReceipt,
        editionSize: collectibleReceipt ? editionSize : null,
      });
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
      imageUrl,
      isOnline,
    });
    return NextResponse.json({ qrPoint });
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (message === "PRODUCT_IMAGE_COLUMN_MISSING") {
      return NextResponse.json(
        {
          error: "Product images are not set up on this database yet.",
          code: "PRODUCT_IMAGE_COLUMN_MISSING",
        },
        { status: 503 },
      );
    }
    console.error("[qr-points] create error:", err);
    return NextResponse.json({ error: "Failed to create QR point" }, { status: 500 });
  }
}
