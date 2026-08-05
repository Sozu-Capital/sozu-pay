/**
 * In-app approval queue for Org treasury spends (NO-GO fallback).
 * Non-owners enqueue; treasury owner approves and executes.
 */

export type SpendRequestStatus =
  | "pending"
  | "executed"
  | "rejected"
  | "awaiting_owner_client_tx";

export type SpendRequestPayment = {
  paymentId: string;
  toAddress: string;
  amount: string;
  recipientLabel?: string;
};

export type SpendRequest = {
  id: string;
  orgId: string;
  disbursementId: string;
  fromAddress: string;
  payments: SpendRequestPayment[];
  totalAmount: string;
  status: SpendRequestStatus;
  requestedByUserId: string;
  requestedByLabel: string;
  approvedByUserId?: string;
  approvedByLabel?: string;
  txHashes?: string[];
  createdAt: string;
  updatedAt: string;
};

const byId = new Map<string, SpendRequest>();

function sumAmounts(payments: SpendRequestPayment[]): string {
  let total = 0;
  for (const p of payments) {
    const n = Number(p.amount);
    if (Number.isFinite(n)) total += n;
  }
  return total.toFixed(7).replace(/\.?0+$/, "") || "0";
}

export function createSpendRequest(input: {
  orgId: string;
  disbursementId: string;
  fromAddress: string;
  payments: SpendRequestPayment[];
  requestedByUserId: string;
  requestedByLabel: string;
  status?: SpendRequestStatus;
}): SpendRequest {
  const now = new Date().toISOString();
  const row: SpendRequest = {
    id: crypto.randomUUID(),
    orgId: input.orgId,
    disbursementId: input.disbursementId,
    fromAddress: input.fromAddress,
    payments: input.payments,
    totalAmount: sumAmounts(input.payments),
    status: input.status ?? "pending",
    requestedByUserId: input.requestedByUserId,
    requestedByLabel: input.requestedByLabel,
    createdAt: now,
    updatedAt: now,
  };
  byId.set(row.id, row);
  return row;
}

export function getSpendRequest(id: string): SpendRequest | null {
  return byId.get(id) ?? null;
}

export function listPendingSpendRequests(orgId: string): SpendRequest[] {
  return [...byId.values()]
    .filter((r) => r.orgId === orgId && (r.status === "pending" || r.status === "awaiting_owner_client_tx"))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function markSpendRequestExecuted(
  id: string,
  actor: { userId: string; label: string },
  txHashes: string[],
): SpendRequest | null {
  const row = byId.get(id);
  if (!row) return null;
  row.status = "executed";
  row.approvedByUserId = actor.userId;
  row.approvedByLabel = actor.label;
  row.txHashes = txHashes;
  row.updatedAt = new Date().toISOString();
  return row;
}

export function markSpendRequestRejected(
  id: string,
  actor: { userId: string; label: string },
): SpendRequest | null {
  const row = byId.get(id);
  if (!row) return null;
  row.status = "rejected";
  row.approvedByUserId = actor.userId;
  row.approvedByLabel = actor.label;
  row.updatedAt = new Date().toISOString();
  return row;
}

/** Test helper — clear in-memory queue. */
export function resetSpendRequestsForTests(): void {
  byId.clear();
}
