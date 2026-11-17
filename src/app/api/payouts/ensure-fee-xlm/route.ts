import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getUserBySessionId } from "@/lib/db/users";
import { getOrganizationForUser } from "@/lib/db/organizations";
import { ensureSpendableXlmForFees } from "@/lib/stellar/fund";
import { usesPollarHomeTreasury } from "@/lib/payouts/home-treasury-signer";

/**
 * Top up Home treasury spendable XLM so Pollar can pay network fees.
 * Body optional: { address?: string } — defaults to org Home treasury G.
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = await getUserBySessionId(session.id);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const org = user.org_id ? await getOrganizationForUser(user.org_id) : null;
  const body = await request.json().catch(() => ({}));
  const requested =
    typeof body.address === "string" ? body.address.trim() : "";
  const userG = (user.stellar_public_key ?? "").trim();
  const homeG = (org?.stellar_disbursement_public_key ?? "").trim();
  const address = requested.startsWith("G") ? requested : userG || homeG;

  if (!address.startsWith("G")) {
    return NextResponse.json(
      { error: "No Home treasury G address to fund for fees" },
      { status: 400 },
    );
  }

  // Pollar staff send from their session G; Home treasury is the org receive wallet.
  if (usesPollarHomeTreasury(user, org) && address !== homeG && address !== userG) {
    return NextResponse.json(
      { error: "Can only ensure fee XLM for this org’s Home treasury or your Pollar wallet" },
      { status: 403 },
    );
  }

  const result = await ensureSpendableXlmForFees(address);
  if (result.error && !result.toppedUp && !result.alreadyOk) {
    return NextResponse.json(
      { error: result.error, ...result },
      { status: 502 },
    );
  }
  return NextResponse.json({ ok: true, ...result });
}
