import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import {
  getDisbursement,
  listReceivers,
  listAssets,
  retryReceiverWalletInvitation,
  ensureSozuCreditWallet,
} from "@/lib/sdp/adminClient";
import { sendSdpInviteEmail } from "@/lib/email/sdp-invite";
import { signSdpInviteUrl } from "@/lib/sdp/signInviteUrl";

const WALLET_BASE_URL =
  process.env.SOZUCREDIT_URL ?? "https://credit.sozu.capital";

const WALLET_INVITE_PATH = process.env.SDP_INVITE_PATHNAME ?? "/sdp/invite";

/**
 * Derives the SDP tenant hostname from the SDP_API_URL env var.
 * e.g. "https://sdp-v2-production-f6c7.up.railway.app" → "sdp-v2-production-f6c7.up.railway.app"
 */
function sdpDomainFromEnv(): string {
  const raw = process.env.SDP_API_URL ?? "";
  try {
    return new URL(raw).hostname;
  } catch {
    return raw.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  }
}

/**
 * POST /api/sdp/disbursements/[id]/send-invites
 *
 * Builds a properly-signed wallet registration deep link (signed with SDP's
 * SEP10_SIGNING_PRIVATE_KEY stored in SDP_SEP10_SIGNING_KEY) and delivers it
 * to each unregistered receiver via Resend.
 *
 * Signing algorithm: identical to SDP Go's internal/utils/url.go SignURL and
 * verified by SozuCredit's lib/sdp/verifyInviteUrl.ts verifySdpRegistrationUrl.
 *
 * URL form: https://credit.sozu.capital/sdp/invite?asset={code}-{issuer}&domain={sdpHost}&name={orgName}&signature={hexSig}
 *
 * Also calls SDP's RetryInvitation endpoint as a secondary channel (if SDP is
 * configured with its own email/SMS sender on Railway, it will also send).
 *
 * Required env: SDP_SEP10_SIGNING_KEY (SEP10_SIGNING_PRIVATE_KEY from Railway SDP service)
 * Optional env: SDP_INVITE_PATHNAME (default: /sdp/invite), SOZUCREDIT_URL
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

  const sep10SigningKey = process.env.SDP_SEP10_SIGNING_KEY?.trim() ?? "";
  const sdpDomain = sdpDomainFromEnv();
  const walletInviteUrl = `${WALLET_BASE_URL}${WALLET_INVITE_PATH}`;

  try {
    const [disbursement, receivers, assets] = await Promise.all([
      getDisbursement(id),
      listReceivers(id),
      listAssets(),
    ]);

    // Ensure credit.sozu.capital is registered in SDP before sending invites —
    // recipients need it for SEP-10 client_domain validation to succeed.
    await ensureSozuCreditWallet(assets.map((a) => ({ code: a.code, issuer: a.issuer })));

    const assetCode = disbursement.asset?.code ?? "USDC";
    const assetIssuer = disbursement.asset?.issuer ?? "";

    const results: Array<{
      email: string;
      inviteSent: boolean;
      sdpTriggered: boolean;
      skipped: boolean;
      error?: string;
    }> = [];

    for (const receiver of receivers) {
      const email = receiver.email ?? receiver.phone_number;
      if (!email) continue;

      const wallet = receiver.receiver_wallet;
      const walletId = wallet?.id;

      if (wallet?.status === "REGISTERED") {
        results.push({ email, inviteSent: false, sdpTriggered: false, skipped: true });
        continue;
      }

      let inviteSent = false;
      let sdpTriggered = false;
      let error: string | undefined;

      // Step 1 — send signed deep link via Resend (primary channel).
      if (receiver.email) {
        let registrationUrl = walletInviteUrl;

        if (sep10SigningKey) {
          try {
            const signedUrl = signSdpInviteUrl(
              walletInviteUrl,
              assetCode,
              assetIssuer,
              sdpDomain,
              organizationName,
              sep10SigningKey
            );
            // Append tenant as unsigned param AFTER the signature so existing
            // verifiers can ignore it while new SozuCredit versions read it.
            const tenantName = process.env.SDP_TENANT_NAME?.trim();
            registrationUrl = tenantName
              ? `${signedUrl}&tenant=${encodeURIComponent(tenantName)}`
              : signedUrl;
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            console.warn("[send-invites] URL signing failed, falling back to plain invite URL:", msg);
            error = `signing: ${msg}`;
          }
        } else {
          console.warn(
            "[send-invites] SDP_SEP10_SIGNING_KEY is not set — sending plain invite URL. " +
            "Set SDP_SEP10_SIGNING_KEY to SEP10_SIGNING_PRIVATE_KEY from the Railway SDP service."
          );
          error = "SDP_SEP10_SIGNING_KEY not configured";
        }

        const emailResult = await sendSdpInviteEmail({
          toEmail: receiver.email,
          organizationName,
          registrationUrl,
          disbursementName: disbursement.name,
        });
        inviteSent = emailResult.sent;
      }

      // Step 2 — also trigger SDP's own message channel as a secondary path.
      if (walletId) {
        try {
          await retryReceiverWalletInvitation(receiver.id, walletId);
          sdpTriggered = true;
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.warn(
            `[send-invites] SDP RetryInvitation failed for receiver ${receiver.id}:`,
            msg
          );
        }
      }

      results.push({ email, inviteSent, sdpTriggered, skipped: false, error });
    }

    const sentCount = results.filter((r) => r.inviteSent).length;
    const skippedCount = results.filter((r) => r.skipped).length;
    const failedCount = results.filter((r) => !r.skipped && !r.inviteSent).length;

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
