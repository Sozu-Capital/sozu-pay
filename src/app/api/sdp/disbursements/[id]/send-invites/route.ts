import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { requireDisbursementAdmin } from "@/lib/auth/disbursement-auth";
import {
  getDisbursement,
  listReceivers,
  listAssets,
  ensureSozuCreditWallet,
} from "@/lib/sdp/adminClient";
import { sendSdpInviteEmail } from "@/lib/email/sdp-invite";
import { getSdpEnv } from "@/lib/sdp/env";
import { signSdpInviteUrl } from "@/lib/sdp/signInviteUrl";
import {
  externalIdAsBeneficiaryName,
  externalIdToDisplayName,
  receiverVerificationDob,
} from "@/lib/sdp/receiverDisplay";
import {
  actorLabelFromUser,
  markInvitesSentAsync,
  mergedUploadedVerificationsAsync,
} from "@/lib/disbursements/store";
import { validateDisbursementFunds } from "@/lib/sdp/validateDisbursementStart";
import { ensureSdpOrgMessagingForExternalInvites } from "@/lib/sdp/org-messaging";
import { getUserBySessionId } from "@/lib/db/users";
import { getOrganizationById } from "@/lib/db/organizations";
import { requireDisbursementOrgAccess } from "@/lib/disbursements/org-scope";

const WALLET_BASE_URL =
  process.env.SOZUCREDIT_URL ?? "https://credit.sozu.capital";

const WALLET_INVITE_PATH = process.env.SDP_INVITE_PATHNAME ?? "/sdp/invite";

function appendUnsignedInviteParams(
  url: string,
  params: Record<string, string | undefined>
): string {
  const u = new URL(url);
  for (const [key, value] of Object.entries(params)) {
    if (value?.trim()) u.searchParams.set(key, value.trim());
  }
  return u.toString();
}

/**
 * Derives the SDP tenant hostname from the SDP_API_URL env var.
 * e.g. "https://sdp-v2-production-f6c7.up.railway.app" → "sdp-v2-production-f6c7.up.railway.app"
 */
function sdpDomainFromEnv(): string {
  const raw = getSdpEnv().apiUrl;
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

  const auth = await requireDisbursementAdmin(session.id);
  if (!auth.ok) return auth.response;

  const { id } = await params;

  const orgAccess = await requireDisbursementOrgAccess(id, auth.user.org_id!);
  if (!orgAccess.ok) return orgAccess.response;

  const org = await getOrganizationById(auth.user.org_id!);
  let organizationName = org?.name?.trim() || "Your organization";
  try {
    const body = await request.json().catch(() => ({}));
    if (typeof body?.organizationName === "string" && body.organizationName.trim()) {
      organizationName = body.organizationName.trim();
    }
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

    const uploadedByEmail = await mergedUploadedVerificationsAsync(id);

    if (!org) {
      return NextResponse.json({ error: "Organization not found." }, { status: 404 });
    }

    const funding = await validateDisbursementFunds({ org, disbursement });
    if (!funding.ok) {
      return NextResponse.json(
        { error: funding.error, code: funding.code },
        { status: 400 }
      );
    }

    // Branded invites go through Resend only — disable SDP's plain Railway /r/… emails.
    await ensureSdpOrgMessagingForExternalInvites(organizationName);

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

      if (wallet?.status === "REGISTERED") {
        results.push({ email, inviteSent: false, sdpTriggered: false, skipped: true });
        continue;
      }

      let inviteSent = false;
      let error: string | undefined;

      // Signed deep link via Resend (Sozu-branded — not SDP Railway /r/… emails).
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
            const uploadedDob = uploadedByEmail[receiver.email.trim().toLowerCase()];
            const inviteDob = uploadedDob || receiverVerificationDob(receiver);
            registrationUrl = appendUnsignedInviteParams(signedUrl, {
              tenant: tenantName,
              be: receiver.email,
              bn: externalIdToDisplayName(receiver.external_id ?? ""),
              bd: inviteDob,
            });
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

        const recipientName =
          externalIdAsBeneficiaryName(receiver.external_id ?? "") ??
          (externalIdToDisplayName(receiver.external_id ?? "") || undefined);

        const emailResult = await sendSdpInviteEmail({
          toEmail: receiver.email,
          recipientName,
          organizationName,
          campaignName: disbursement.name,
          registrationUrl,
          amountUsdc: receiver.payment?.amount,
        });
        inviteSent = emailResult.sent;
        if (!emailResult.sent && emailResult.error) {
          error = emailResult.error;
        }
      }

      results.push({ email, inviteSent, sdpTriggered: false, skipped: false, error });
    }

    const sentCount = results.filter((r) => r.inviteSent).length;
    const skippedCount = results.filter((r) => r.skipped).length;
    const failedCount = results.filter((r) => !r.skipped && !r.inviteSent).length;

    const user = await getUserBySessionId(session.id);
    const label = user ? actorLabelFromUser(user) : session.id;
    await markInvitesSentAsync(id, { userId: session.id, label }, {
      sent: sentCount,
      skipped: skippedCount,
      failed: failedCount,
    });

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
