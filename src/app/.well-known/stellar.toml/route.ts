import { NextResponse } from "next/server";
import { Keypair } from "@stellar/stellar-sdk";

/**
 * SEP-0001 stellar.toml for wallet home domain (SEP-10 client_domain).
 * SDP fetches this to validate client_domain signatures.
 */
export async function GET() {
  const secret = process.env.SEP10_CLIENT_SIGNING_SECRET?.trim();
  if (!secret) {
    return new NextResponse(
      "# SEP10_CLIENT_SIGNING_SECRET is not set\n",
      { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } }
    );
  }

  let kp: Keypair;
  try {
    kp = Keypair.fromSecret(secret);
  } catch {
    return new NextResponse("# Invalid SEP10_CLIENT_SIGNING_SECRET\n", {
      status: 500,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const documentation =
    process.env.WALLET_DOCUMENTATION_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "https://sozupay.com";

  const body =
    `VERSION="2.0.0"\n` +
    `SIGNING_KEY="${kp.publicKey()}"\n` +
    `DOCUMENTATION="${documentation.replace(/"/g, '\\"')}"\n`;

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
}
