import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { resolvePaymentRecipient } from "@/lib/payment/resolve-recipient";

export const dynamic = "force-dynamic";

/**
 * POST /api/wallet/resolve-recipient
 * Body: { recipient: string } — Sozu tag ($username) or Stellar address.
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const rawRecipient = typeof body.recipient === "string" ? body.recipient : "";
  if (!rawRecipient.trim()) {
    return NextResponse.json({ error: "Recipient is required." }, { status: 400 });
  }

  const result = await resolvePaymentRecipient(rawRecipient);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const { recipient } = result;
  return NextResponse.json({
    walletAddress: recipient.walletAddress,
    tag: recipient.tag,
    paymentRail: recipient.paymentRail,
    ...(recipient.receiveTarget && { receiveTarget: recipient.receiveTarget }),
  });
}
