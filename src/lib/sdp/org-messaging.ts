import "server-only";

import { buildSdpOtpHtmlTemplate } from "@/lib/email/sdp-otp-template";
import { patchSdpOrganization, startDisbursement } from "@/lib/sdp/adminClient";

/**
 * Dashboard sends branded batch invites via Resend. Disable SDP's built-in
 * invitation emails and apply Sozu HTML for OTP messages on Railway SDP.
 */
export async function ensureSdpOrgMessagingForExternalInvites(_orgDisplayName?: string): Promise<void> {
  const desiredOtpTemplate = buildSdpOtpHtmlTemplate(_orgDisplayName);

  try {
    await patchSdpOrganization({
      receiver_invitations_disabled: true,
      receiver_invitation_resend_interval_days: 0,
      otp_message_template: desiredOtpTemplate,
    });
  } catch (e) {
    console.warn("[sdp/org-messaging] PATCH /organization failed:", e);
  }
}

/** Start SDP batch after funding so wallets move to READY — SDP invite emails stay disabled above. */
export async function startSdpCampaignIfDraft(params: {
  disbursementId: string;
  currentStatus: string;
}): Promise<{ started: boolean; alreadyStarted: boolean }> {
  const current = params.currentStatus.toUpperCase();
  if (current === "STARTED") {
    return { started: false, alreadyStarted: true };
  }
  if (current !== "DRAFT" && current !== "READY") {
    return { started: false, alreadyStarted: false };
  }

  await startDisbursement(params.disbursementId);
  return { started: true, alreadyStarted: false };
}
