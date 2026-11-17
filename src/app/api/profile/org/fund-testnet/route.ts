import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getUserBySessionId } from "@/lib/db/users";
import { getOrganizationById } from "@/lib/db/organizations";
import { resolveCanonicalActiveOrgId } from "@/lib/db/org-members";
import { resolveOrgReceiveAddress } from "@/lib/org-receive-address";
import {
  claimTestnetUsdcViaSozuFaucet,
  isStellarTestnet,
} from "@/lib/faucet/claim-testnet-usdc";

export const dynamic = "force-dynamic";
/** PoW solve + claim can take a few seconds (same as `npx @sozu/faucet claim`). */
export const maxDuration = 60;

/**
 * POST /api/profile/org/fund-testnet
 * Testnet-only: claim 100 Circle USDC (SAC) from Sozu Faucet into the org treasury
 * (equivalent to `npx @sozu/faucet@latest claim <treasuryAddress>`).
 */
export async function POST() {
  if (!isStellarTestnet()) {
    return NextResponse.json(
      {
        error: "Testnet faucet funding is only available when STELLAR_NETWORK=testnet.",
        code: "NOT_TESTNET",
      },
      { status: 403 },
    );
  }

  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await getUserBySessionId(session.id);
  if (!user) return NextResponse.json({ error: "User not found." }, { status: 404 });

  const orgId = await resolveCanonicalActiveOrgId({
    userId: user.id,
    primaryOrgId: user.org_id,
    sessionOrgId: session.orgId,
    staffPublicKey: user.stellar_public_key,
  });
  if (!orgId) return NextResponse.json({ error: "No organization." }, { status: 404 });

  const org = await getOrganizationById(orgId);
  if (!org) return NextResponse.json({ error: "Organization not found." }, { status: 404 });

  const receive = resolveOrgReceiveAddress(org);
  const to =
    receive.dashboardBalanceAddress ??
    receive.tagReceiveAddress ??
    receive.classicG ??
    null;

  if (!to) {
    return NextResponse.json(
      {
        error:
          "Organization has no receivable treasury yet. Finish wallet setup, then retry faucet funding.",
        code: "NO_TREASURY",
      },
      { status: 422 },
    );
  }

  const result = await claimTestnetUsdcViaSozuFaucet(to);
  if (!result.ok) {
    const status =
      result.reason === "trustline_required" || result.reason === "account_missing"
        ? 422
        : result.reason === "user_cooldown" || result.reason === "global_cooldown"
          ? 429
          : 502;
    return NextResponse.json(
      {
        error: result.error,
        code: result.reason ?? "FAUCET_CLAIM_FAILED",
        helpUrl: result.helpUrl ?? null,
        to,
        amount: result.amount ?? 100,
      },
      { status },
    );
  }

  return NextResponse.json({
    ok: true,
    network: "testnet",
    amount: result.amount,
    to: result.to,
    txHash: result.txHash ?? null,
    explorerUrl: result.explorerUrl ?? null,
    source: "sozu_faucet",
    equivalentCli: `npx @sozu/faucet@latest claim ${result.to}`,
  });
}

/** GET — whether testnet faucet funding is available for this org. */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await getUserBySessionId(session.id);
  const orgId = user
    ? await resolveCanonicalActiveOrgId({
        userId: user.id,
        primaryOrgId: user.org_id,
        sessionOrgId: session.orgId,
        staffPublicKey: user.stellar_public_key,
      })
    : null;
  if (!orgId) {
    return NextResponse.json({
      testnet: isStellarTestnet(),
      available: false,
      amount: 100,
    });
  }

  const org = await getOrganizationById(orgId);
  const receive = org ? resolveOrgReceiveAddress(org) : null;
  const to =
    receive?.dashboardBalanceAddress ??
    receive?.tagReceiveAddress ??
    receive?.classicG ??
    null;

  return NextResponse.json({
    testnet: isStellarTestnet(),
    available: isStellarTestnet() && !!to,
    amount: 100,
    to,
  });
}
