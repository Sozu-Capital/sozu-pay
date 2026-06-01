import { NextRequest, NextResponse } from "next/server";
import { xdr } from "@stellar/stellar-sdk";
import { resolveOnChainSignerKeyData } from "@/lib/stellar/smartAccounts/resolveOnChainPublicKey";

/**
 * GET /api/smart-accounts/resolve-key-data?contractId=&credentialId=&authEntryXdr=
 * Resolves OZ External signer keyData via get_context_rule (not kit get_context_rules on wrong contract).
 */
export async function GET(request: NextRequest) {
  const contractId = request.nextUrl.searchParams.get("contractId")?.trim() ?? "";
  const credentialId = request.nextUrl.searchParams.get("credentialId")?.trim() ?? "";
  const authEntryXdr = request.nextUrl.searchParams.get("authEntryXdr")?.trim() ?? "";

  if (!contractId.startsWith("C") || !credentialId) {
    return NextResponse.json({ error: "contractId and credentialId are required." }, { status: 400 });
  }

  let authEntry: xdr.SorobanAuthorizationEntry | undefined;
  if (authEntryXdr) {
    try {
      authEntry = xdr.SorobanAuthorizationEntry.fromXDR(authEntryXdr, "base64");
    } catch {
      return NextResponse.json({ error: "Invalid authEntryXdr." }, { status: 400 });
    }
  }

  const keyData = await resolveOnChainSignerKeyData({
    contractId,
    credentialId,
    authEntry,
  });

  if (!keyData) {
    return NextResponse.json(
      { error: "Signer keyData not found on this smart account." },
      { status: 404 }
    );
  }

  return NextResponse.json({ keyDataBase64: keyData.toString("base64") });
}
