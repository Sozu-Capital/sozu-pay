import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { listAssets, ensureSozuCreditWallet, listWallets } from "@/lib/sdp/adminClient";
import { isSdpConfigured, sdpNotConfiguredMessage } from "@/lib/sdp/env";
import { ensureSdpOrgMessagingForExternalInvites } from "@/lib/sdp/org-messaging";

async function runSetup() {
  await ensureSdpOrgMessagingForExternalInvites();
  const assets = await listAssets();
  const walletId = await ensureSozuCreditWallet(
    assets.map((a) => ({ code: a.code, issuer: a.issuer }))
  );
  const wallets = await listWallets();
  const wallet = wallets.find((w) => w.id === walletId) ?? null;
  return { walletId, wallet };
}

/**
 * GET /api/sdp/setup?secret=<SETUP_SECRET>
 *
 * Idempotent: registers credit.sozu.capital as a wallet in the SDP tenant.
 * Protected by SETUP_SECRET env var (or dashboard session).
 * Open in a browser once after deploy to unblock recipients' SEP-10 flow.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get("secret") ?? "";
  const setupSecret = process.env.SETUP_SECRET?.trim();

  // Allow either a matching SETUP_SECRET query param OR a logged-in session
  const session = await getSession();
  if (!session && (!setupSecret || secret !== setupSecret)) {
    return NextResponse.json(
      { error: "Pass ?secret=<SETUP_SECRET> or log in to the dashboard first" },
      { status: 401 }
    );
  }

  if (!isSdpConfigured()) {
    return NextResponse.json({ error: sdpNotConfiguredMessage() }, { status: 503 });
  }

  try {
    const { walletId, wallet } = await runSetup();
    return NextResponse.json({
      ok: true,
      walletId,
      wallet,
      message: walletId
        ? `SozuCredit wallet registered in SDP (id: ${walletId}).`
        : "Could not register wallet — check server logs.",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[api/sdp/setup GET]", msg);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

/**
 * POST /api/sdp/setup
 * Same as GET but requires dashboard session (called from the UI).
 */
export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isSdpConfigured()) {
    return NextResponse.json({ error: sdpNotConfiguredMessage() }, { status: 503 });
  }

  try {
    const { walletId, wallet } = await runSetup();
    return NextResponse.json({
      ok: true,
      walletId,
      wallet,
      message: walletId
        ? `SozuCredit wallet registered in SDP (id: ${walletId}).`
        : "Could not register wallet — check server logs.",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[api/sdp/setup POST]", msg);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
