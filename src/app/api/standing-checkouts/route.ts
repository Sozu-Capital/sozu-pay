import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getUserBySessionId } from "@/lib/db/users";
import { createStandingCheckout, listStandingCheckoutsForOrg } from "@/lib/db/standing-checkouts";
import { ensureOrgStoreSlug } from "@/lib/db/store-slugs";
import { namedCheckoutUrl, normalizePublicSlug } from "@/lib/named-checkout";
import { isReservedStoreSlug } from "@/lib/named-checkout/slugs";

async function orgIdFromSession() {
  const session = await getSession();
  if (!session) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const user = await getUserBySessionId(session.id);
  const orgId = session.orgId ?? user?.org_id ?? null;
  if (!orgId) {
    return { error: NextResponse.json({ error: "No organization" }, { status: 403 }) };
  }
  return { orgId };
}

export async function GET() {
  const auth = await orgIdFromSession();
  if ("error" in auth) return auth.error;
  const storeSlug = await ensureOrgStoreSlug(auth.orgId);
  const rows = await listStandingCheckoutsForOrg(auth.orgId);
  return NextResponse.json({
    storeSlug,
    checkouts: rows.map((row) => ({
      id: row.id,
      checkoutSlug: row.checkout_slug,
      amountUsd: row.amount_usd,
      live: row.live,
      deadlineAt: row.deadline_at,
      namedCheckoutUrl: storeSlug
        ? namedCheckoutUrl(storeSlug, row.checkout_slug)
        : null,
      createdAt: row.created_at,
    })),
  });
}

export async function POST(request: NextRequest) {
  const auth = await orgIdFromSession();
  if ("error" in auth) return auth.error;
  const body = await request.json().catch(() => null);
  const checkoutSlug = normalizePublicSlug(
    typeof body?.checkoutSlug === "string" ? body.checkoutSlug : "",
  );
  const amountUsd =
    typeof body?.amountUsd === "string" ? body.amountUsd.trim() : "";
  const deadlineAt =
    typeof body?.deadlineAt === "string" && body.deadlineAt.trim()
      ? body.deadlineAt.trim()
      : null;
  if (!checkoutSlug || isReservedStoreSlug(checkoutSlug)) {
    return NextResponse.json({ error: "Invalid checkout slug" }, { status: 400 });
  }
  if (!amountUsd || Number.isNaN(parseFloat(amountUsd)) || parseFloat(amountUsd) <= 0) {
    return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
  }
  if (deadlineAt && Number.isNaN(Date.parse(deadlineAt))) {
    return NextResponse.json({ error: "Invalid deadline" }, { status: 400 });
  }

  const storeSlug = await ensureOrgStoreSlug(auth.orgId);
  const id = `sc_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  try {
    const created = await createStandingCheckout({
      id,
      orgId: auth.orgId,
      checkoutSlug,
      amountUsd,
      live: true,
      deadlineAt,
    });
    return NextResponse.json({
      id: created.id,
      checkoutSlug: created.checkout_slug,
      amountUsd: created.amount_usd,
      live: created.live,
      deadlineAt: created.deadline_at,
      namedCheckoutUrl: storeSlug
        ? namedCheckoutUrl(storeSlug, created.checkout_slug)
        : null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create";
    const status = /duplicate|unique/i.test(message) ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
