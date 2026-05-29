import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { resolveOnChainPasskeyPublicKey } from "@/lib/stellar/smartAccounts/resolveOnChainPublicKey";

/**
 * GET /api/smart-accounts/resolve-public-key?contractId=&credentialId=
 * Reads the passkey public key from an on-chain smart account (for connect-existing flow).
 */
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const contractId = request.nextUrl.searchParams.get("contractId")?.trim() ?? "";
  const credentialId = request.nextUrl.searchParams.get("credentialId")?.trim() ?? "";

  if (!contractId || !credentialId) {
    return NextResponse.json(
      { error: "contractId and credentialId are required." },
      { status: 400 }
    );
  }

  const publicKey65b = await resolveOnChainPasskeyPublicKey({ contractId, credentialId });
  if (!publicKey65b) {
    return NextResponse.json(
      { error: "Passkey public key not found for this smart account." },
      { status: 404 }
    );
  }

  return NextResponse.json({ publicKey65b });
}
