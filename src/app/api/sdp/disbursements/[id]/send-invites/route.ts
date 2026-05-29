import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import {
  getDisbursement,
  listReceivers,
  retryReceiverWalletInvitation,
} from "@/lib/sdp/adminClient";
import { sendSdpInviteEmail } from "@/lib/email/sdp-invite";

const WALLET_BASE_URL =
  process.env.SOZUCREDIT_URL ?? "https://credit.sozu.capital";

/**
 * POST /api/sdp/disbursements/[id]/send-invites
 *
 * Two-step invite per unregistered receiver:
 *
 * 1. PATCH /receivers/{id}/wallets/{wallet_id} → triggers SDP to generate
 *    a cryptographically-signed deep link and deliver it via its own
 *    message channel (email/SMS configured in SDP settings on Railway).
 *    This is the only supported way to produce a valid signed invite URL.
 *
 * 2. Resend email (if RESEND_API_KEY is set) → supplemental notification
 *    that tells the recipient a payment is waiting and to check their
 *    inbox for the registration link from SDP.
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
      sdpTriggered: boolean;
      notificationSent: boolean;
      skipped: boolean;
      error?: string;
    }> = [];

    for (const receiver of receivers) {
      const email = receiver.email ?? receiver.phone_number;
      if (!email) continue;

      const wallet = receiver.receiver_wallet;
      const walletId = wallet?.id;

      // Skip receivers who already have a registered wallet.
      if (wallet?.status === "REGISTERED") {
        results.push({ email, sdpTriggered: false, notificationSent: false, skipped: true });
        continue;
      }

      let sdpTriggered = false;
      let sdpError: string | undefined;

      // Step 1 — ask SDP to (re)send its own signed registration link.
      if (walletId) {
        try {
          await retryReceiverWalletInvitation(receiver.id, walletId);
          sdpTriggered = true;
        } catch (e) {
          sdpError = e instanceof Error ? e.message : String(e);
          console.warn(
            `[send-invites] SDP RetryInvitation failed for receiver ${receiver.id}:`,
            sdpError
          );
        }
      }

      // Step 2 — supplemental Resend notification (if receiver has email).
      let notificationSent = false;
      if (receiver.email) {
        const notifResult = await sendSdpInviteEmail({
          toEmail: receiver.email,
          organizationName,
          // Point to the wallet homepage; recipient's real invite arrives from SDP.
          registrationUrl: WALLET_BASE_URL,
          disbursementName: disbursement.name,
        });
        notificationSent = notifResult.sent;
      }

      results.push({
        email,
        sdpTriggered,
        notificationSent,
        skipped: false,
        error: sdpError,
      });
    }

    const sentCount = results.filter((r) => r.sdpTriggered || r.notificationSent).length;
    const skippedCount = results.filter((r) => r.skipped).length;
    const failedCount = results.filter(
      (r) => !r.skipped && !r.sdpTriggered && !r.notificationSent
    ).length;

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
