import { effectiveCheckoutStatus } from "@/lib/checkout/expiration";

export type PosListenPhase = "waiting" | "paid" | "expired" | "failed";

export type PosStatusPollPayload = {
  status?: string;
  expiresAt?: string | null;
};

/**
 * Map a checkout status poll into the POS listen phase.
 * Never reports paid for expired/failed rows (avoids false “paid” after TTL).
 */
export function posListenPhaseFromStatus(
  payload: PosStatusPollPayload,
  now: Date | number = Date.now(),
): PosListenPhase {
  const status = effectiveCheckoutStatus({
    status: payload.status ?? "pending",
    expiresAt: payload.expiresAt,
    now,
  });
  if (status === "completed") return "paid";
  if (status === "expired") return "expired";
  if (status === "failed") return "failed";
  return "waiting";
}

export const POS_STATUS_POLL_MS = 2500;
