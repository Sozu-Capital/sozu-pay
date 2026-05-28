import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getDisbursement, listReceivers } from "@/lib/sdp/adminClient";
import { sendSdpInviteEmail } from "@/lib/email/sdp-invite";

const WALLET_BASE_URL =
  process.env.SOZUCREDIT_URL ?? "https://credit.sozu.capital";

/**
 * POST /api/sdp/disbursements/[id]/send-invites
 *
 * Reads receivers from SDP, builds registration URLs, and sends invite emails
 * via Resend for each receiver that has an email address and has not yet
 * registered (wallet status != REGISTERED).
 *
 * Body (optional JSON): { organizationName?: string }
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  let organizationName = "Your organization";
  try {
    const body = await request.json().catch(() => ({}));
    if (body?.organizationName) organizationName = String(body.organizationName);
  } catch {
    // body optional
  }

  try {
    const [disbursement, receivers] = await Promise.all([
      getDisbursement(id),
      listReceivers(id),
    ]);

    const results: Array<{
      email: string;
      sent: boolean;
      skipped: boolean;
      error?: string;
    }> = [];

    for (const receiver of receivers) {
      const email = receiver.email;
      if (!email) continue;

      // Skip receivers who already have a registered wallet.
      const alreadyRegistered = receiver.wallets?.some(
        (w) => w.status === "REGISTERED"
      );
      if (alreadyRegistered) {
        results.push({ email, sent: false, skipped: true });
        continue;
      }

      // Build a registration URL pointing at the SozuCredit wallet.
      // The SDP invite flow uses /sdp/invite on the wallet domain.
      const registrationUrl = buildRegistrationUrl(
        disbursement.id,
        receiver.id
      );

      const result = await sendSdpInviteEmail({
        toEmail: email,
        organizationName,
        registrationUrl,
        disbursementName: disbursement.name,
      });

      results.push({ email, ...result });
    }

    const sentCount = results.filter((r) => r.sent).length;
    const skippedCount = results.filter((r) => r.skipped).length;
    const failedCount = results.filter((r) => !r.sent && !r.skipped).length;

    return NextResponse.json({
      ok: true,
      sent: sentCount,
      skipped: skippedCount,
      failed: failedCount,
      results,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[api/sdp/disbursements/[id]/send-invites]", msg);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

function buildRegistrationUrl(disbursementId: string, receiverId: string): string {
  const base = WALLET_BASE_URL.replace(/\/$/, "");
  const url = new URL(`${base}/sdp/invite`);
  url.searchParams.set("disbursement_id", disbursementId);
  url.searchParams.set("receiver_id", receiverId);
  return url.toString();
}
