import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getUserBySessionId } from "@/lib/db/users";
import { buildTrustlineTransaction } from "@/lib/stellar/trustline";

/**
 * GET /api/profile/wallet/trustline-tx
 * Returns an unsigned changeTrust (USDC trustline) envelope for the current user's
 * registered Stellar account. Client signs with wallet (auth) and submits to Horizon.
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await getUserBySessionId(session.id);
  if (!user?.stellar_public_key) {
    return NextResponse.json(
      { error: "No Stellar wallet registered. Add a wallet in Profile first." },
      { status: 400 }
    );
  }

  try {
    const { envelopeXdr, network, networkPassphrase } =
      await buildTrustlineTransaction(user.stellar_public_key);
    return NextResponse.json({
      envelope_xdr: envelopeXdr,
      network,
      network_passphrase: networkPassphrase,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to build transaction";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
