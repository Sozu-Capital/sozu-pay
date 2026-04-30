import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getUserByPrivyId } from "@/lib/db/users";
import { getHorizon } from "@/lib/stellar/server";

const USDC_ISSUER_TESTNET =
  "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";
const USDC_ISSUER_PUBLIC =
  "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4EZN";

function getUsdcIssuer(): string {
  return process.env.STELLAR_NETWORK === "public"
    ? USDC_ISSUER_PUBLIC
    : USDC_ISSUER_TESTNET;
}

/**
 * GET /api/profile/wallet/trustline-status
 * Returns whether the current user's Stellar account has a USDC trustline.
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await getUserByPrivyId(session.id);
  if (!user?.stellar_public_key) {
    return NextResponse.json({
      needs_trustline: false,
      has_trustline: false,
      error: "No Stellar wallet registered",
    });
  }

  try {
    const horizon = getHorizon();
    const account = await horizon.loadAccount(user.stellar_public_key);
    const issuer = getUsdcIssuer();
    const hasTrustline = account.balances.some(
      (b) =>
        b.asset_type === "credit_alphanum4" &&
        b.asset_code === "USDC" &&
        (b as { asset_issuer?: string }).asset_issuer === issuer
    );
    return NextResponse.json({
      needs_trustline: !hasTrustline,
      has_trustline: hasTrustline,
    });
  } catch {
    return NextResponse.json({
      needs_trustline: true,
      has_trustline: false,
    });
  }
}
