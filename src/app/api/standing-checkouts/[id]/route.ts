import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getUserBySessionId } from "@/lib/db/users";
import { updateStandingCheckout } from "@/lib/db/standing-checkouts";
import { ensureOrgStoreSlug } from "@/lib/db/store-slugs";
import { namedCheckoutUrl } from "@/lib/named-checkout";

type Props = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Props) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await getUserBySessionId(session.id);
  const orgId = session.orgId ?? user?.org_id ?? null;
  if (!orgId) return NextResponse.json({ error: "No organization" }, { status: 403 });

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const live = typeof body?.live === "boolean" ? body.live : undefined;
  const deadlineAt =
    body?.deadlineAt === null
      ? null
      : typeof body?.deadlineAt === "string"
        ? body.deadlineAt
        : undefined;
  const amountUsd = typeof body?.amountUsd === "string" ? body.amountUsd.trim() : undefined;

  const updated = await updateStandingCheckout(id, orgId, { live, deadlineAt, amountUsd });
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const storeSlug = await ensureOrgStoreSlug(orgId);
  return NextResponse.json({
    id: updated.id,
    checkoutSlug: updated.checkout_slug,
    amountUsd: updated.amount_usd,
    live: updated.live,
    deadlineAt: updated.deadline_at,
    namedCheckoutUrl: storeSlug
      ? namedCheckoutUrl(storeSlug, updated.checkout_slug)
      : null,
  });
}
