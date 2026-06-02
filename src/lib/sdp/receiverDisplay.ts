import type { SdpReceiver } from "@/lib/sdp/adminClient";
import type { BeneficiaryHint } from "@/lib/sdp/resolve-beneficiary-hints";

export type BeneficiaryLifecycleState = "draft" | "live" | "sent";

/** Slug from batch CSV `id` column → display name for identity matching. */
export function externalIdToDisplayName(externalId: string): string {
  const trimmed = externalId.trim();
  if (!trimmed) return "";
  return trimmed
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Prefer real person names from CSV `id`; skip opaque codes like RCP001. */
export function externalIdAsBeneficiaryName(externalId: string): string | null {
  const raw = externalId.trim();
  if (!raw) return null;
  if (raw.includes("@")) return null;
  if (/^rcp[_-]?\d+$/i.test(raw)) return null;
  if (/^[0-9a-f-]{36}$/i.test(raw)) return null;
  if (/^\d+$/.test(raw)) return null;

  const display = externalIdToDisplayName(raw);
  if (!display) return null;

  if (raw.includes("_") || display.includes(" ")) return display;
  if (raw.length <= 6 && /^[a-z0-9]+$/i.test(raw)) return null;

  return display;
}

export function receiverVerificationDob(receiver: {
  payment?: { verification_field_value?: string; verification?: string } | null;
}): string {
  const p = receiver.payment;
  if (!p) return "";
  return (p.verification_field_value ?? p.verification ?? "").trim();
}

function inviteWasSent(receiver: SdpReceiver): boolean {
  const wallet = receiver.receiver_wallet;
  if (!wallet) return false;
  return !!(
    wallet.invitation_sent_at ||
    wallet.invited_at ||
    wallet.last_message_sent_at
  );
}

/** Map SDP receiver + payment fields to NGO-friendly lifecycle states. */
export function deriveBeneficiaryLifecycleState(
  receiver: SdpReceiver
): BeneficiaryLifecycleState {
  const payment = receiver.payment;
  const wallet = receiver.receiver_wallet;
  const paymentStatus = (payment?.status ?? "DRAFT").toUpperCase();
  const walletStatus = (wallet?.status ?? "").toUpperCase();

  if (paymentStatus === "SUCCESS" || !!payment?.stellar_transaction_id?.trim()) {
    return "sent";
  }

  if (
    paymentStatus !== "DRAFT" ||
    inviteWasSent(receiver) ||
    walletStatus === "REGISTERED" ||
    walletStatus === "CREATED" ||
    walletStatus === "PENDING"
  ) {
    return "live";
  }

  return "draft";
}

export interface BeneficiaryRow {
  id: string;
  amount: string;
  payment_status: string;
  lifecycle_state: BeneficiaryLifecycleState;
  stellar_transaction_id: string | null;
  beneficiary_name: string;
  date_of_birth: string | null;
  sozu_tag: string | null;
  contact: string | null;
  receiver: { id: string; email?: string; phone_number?: string };
  created_at: string;
}

export function mapReceiverToBeneficiaryRow(
  receiver: SdpReceiver,
  tagByAddress: Map<string, string>,
  hintsByEmail: Map<string, BeneficiaryHint> = new Map()
): BeneficiaryRow {
  const payment = receiver.payment;
  const wallet = receiver.receiver_wallet;
  const stellarAddress = wallet?.stellar_address?.trim().toUpperCase();
  const emailKey = receiver.email?.trim().toLowerCase() ?? "";
  const hints = emailKey ? hintsByEmail.get(emailKey) : undefined;

  const sozuTag =
    (stellarAddress ? tagByAddress.get(stellarAddress) ?? null : null) ??
    hints?.sozuTag ??
    null;

  const fromExternalId = externalIdAsBeneficiaryName(receiver.external_id ?? "");
  const beneficiaryName = hints?.fullName || fromExternalId || "—";

  return {
    id: payment?.id ?? receiver.id,
    amount: payment?.amount ?? "—",
    payment_status: payment?.status ?? "DRAFT",
    lifecycle_state: deriveBeneficiaryLifecycleState(receiver),
    stellar_transaction_id: payment?.stellar_transaction_id ?? null,
    beneficiary_name: beneficiaryName,
    date_of_birth: receiverVerificationDob(receiver) || null,
    sozu_tag: sozuTag,
    contact: receiver.email ?? receiver.phone_number ?? null,
    receiver: {
      id: receiver.id,
      email: receiver.email,
      phone_number: receiver.phone_number,
    },
    created_at: payment?.created_at ?? "",
  };
}
