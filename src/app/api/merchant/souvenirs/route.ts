import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getUserBySessionId } from "@/lib/db/users";
import { getOrganizationById } from "@/lib/db/organizations";
import { parseSouvenirLaunch } from "@/lib/souvenirs/launch";
import { listMerchantSouvenirs, publishMerchantSouvenir } from "@/lib/souvenirs/publish";

async function storeOrgForSession() {
  const session = await getSession();
  if (!session) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const user = await getUserBySessionId(session.id);
  const orgId = session.orgId ?? user?.org_id ?? null;
  if (!orgId) return { error: NextResponse.json({ error: "No organization" }, { status: 403 }) };
  const org = await getOrganizationById(orgId);
  if (org?.type !== "store") {
    return { error: NextResponse.json({ error: "Stores only" }, { status: 403 }) };
  }
  return { orgId, org };
}

export async function GET() {
  const auth = await storeOrgForSession();
  if ("error" in auth) return auth.error;
  const souvenirs = await listMerchantSouvenirs(auth.orgId);
  return NextResponse.json({ souvenirs });
}

export async function POST(request: NextRequest) {
  const auth = await storeOrgForSession();
  if ("error" in auth) return auth.error;
  const { orgId, org } = auth;

  const body = await request.json().catch(() => ({}));
  const parsed = parseSouvenirLaunch({
    ...body,
    merchantOrgId: orgId,
    merchantName: org?.name ?? body.merchantName,
  });
  if ("error" in parsed) {
    const message =
      parsed.error === "invalid_image"
        ? "Use a JPEG, PNG, or WebP image."
        : parsed.error === "PRODUCT_IMAGE_TOO_LARGE"
          ? "That image is too large. Try a smaller photo."
          : parsed.error === "invalid_window"
            ? "Pick a claim window that ends after it starts."
            : parsed.error === "invalid_title"
              ? "Title is required."
              : "Could not launch the souvenir.";
    return NextResponse.json({ error: message, code: parsed.error }, { status: 400 });
  }

  try {
    const souvenir = await publishMerchantSouvenir(parsed);
    return NextResponse.json({ souvenir }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "The wallet could not take this souvenir yet." },
      { status: 503 },
    );
  }
}
