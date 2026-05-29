import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { listAssets, ensureSozuCreditWallet, listWallets } from "@/lib/sdp/adminClient";

/**
 * POST /api/sdp/setup
 *
 * One-time idempotent setup: registers credit.sozu.capital as a wallet in the
 * SDP tenant so that SEP-10 client_domain validation succeeds for recipients.
 *
 * Must be called by a logged-in dashboard admin at least once after deployment.
 * Safe to call repeatedly — ensureSozuCreditWallet is idempotent.
 */
export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (
    !process.env.SDP_API_URL ||
    !process.env.SDP_ADMIN_EMAIL ||
    !process.env.SDP_ADMIN_PASSWORD
  ) {
    return NextResponse.json(
      { error: "SDP_API_URL, SDP_ADMIN_EMAIL, or SDP_ADMIN_PASSWORD not configured" },
      { status: 503 }
    );
  }

  try {
    const assets = await listAssets();
    const walletId = await ensureSozuCreditWallet(
      assets.map((a) => ({ code: a.code, issuer: a.issuer }))
    );
    const wallets = await listWallets();
    const wallet = wallets.find((w) => w.id === walletId);

    return NextResponse.json({
      ok: true,
      walletId,
      wallet: wallet ?? null,
      message: walletId
        ? "SozuCredit wallet is registered in SDP."
        : "Could not register wallet — check server logs.",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[api/sdp/setup]", msg);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
