import type { SdpReceiver } from "@/lib/sdp/adminClient";
import type { BeneficiaryHint } from "@/lib/sdp/resolve-beneficiary-hints";
import { normalizeDateOfBirthForSdp } from "@/lib/disbursements/normalizeVerification";

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
  const raw = (p.verification_field_value ?? p.verification ?? "").trim();
  return normalizeDateOfBirthForSdp(raw) ?? raw;
}

export function receiverInviteWasSent(receiver: SdpReceiver): boolean {
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
    receiverInviteWasSent(receiver) ||
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
  /** Editable full legal name (empty when CSV id is an opaque code like RCP001). */
  legal_name: string;
  date_of_birth: string | null;
  /** Where the DOB shown in the dashboard came from. */
  date_of_birth_source?: "uploaded" | "sdp" | null;
  sozu_tag: string | null;
  contact: string | null;
  receiver: { id: string; email?: string; phone_number?: string };
  created_at: string;
}

export function mapReceiverToBeneficiaryRow(
  receiver: SdpReceiver,
  tagByAddress: Map<string, string>,
  hintsByEmail: Map<string, BeneficiaryHint> = new Map(),
  uploadedVerificationByEmail: Record<string, string> = {},
  persistedSozuTagByEmail: Record<string, string> = {}
): BeneficiaryRow {
  const payment = receiver.payment;
  const wallet = receiver.receiver_wallet;
  const stellarAddress = wallet?.stellar_address?.trim().toUpperCase();
  const emailKey = receiver.email?.trim().toLowerCase() ?? "";
  const hints = emailKey ? hintsByEmail.get(emailKey) : undefined;

  const persistedTag = emailKey ? persistedSozuTagByEmail[emailKey]?.trim().replace(/^\$+/, "") : "";
  const sozuTag =
    (stellarAddress ? tagByAddress.get(stellarAddress) ?? null : null) ??
    hints?.sozuTag ??
    (persistedTag || null);

  const fromExternalId = externalIdAsBeneficiaryName(receiver.external_id ?? "");
  const legalName = hints?.fullName || fromExternalId || "";
  const beneficiaryName = legalName || "—";

  const uploadedDob = emailKey ? uploadedVerificationByEmail[emailKey]?.trim() : "";
  const sdpDob = receiverVerificationDob(receiver);
  const dateOfBirth = uploadedDob || sdpDob || null;

  return {
    id: payment?.id ?? receiver.id,
    amount: payment?.amount ?? "—",
    payment_status: payment?.status ?? "DRAFT",
    lifecycle_state: deriveBeneficiaryLifecycleState(receiver),
    stellar_transaction_id: payment?.stellar_transaction_id ?? null,
    beneficiary_name: beneficiaryName,
    legal_name: legalName,
    date_of_birth: dateOfBirth,
    date_of_birth_source: uploadedDob ? "uploaded" : sdpDob ? "sdp" : null,
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
