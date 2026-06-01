/**
 * Payout history – in-memory (global singleton survives Next.js dev HMR).
 * Merged with Stellar tx list for display. Off-ramp via adapter.
 */

export interface PayoutRecord {
  id: string;
  userId: string;
  amount: string;
  type: "to_bank" | "to_stellar";
  bankAccountId?: string;
  stellarAddress?: string;
  recipientLabel?: string;
  stellarTxHash?: string;
  status: "pending" | "completed" | "failed";
  createdAt: string;
}

declare global {
  // eslint-disable-next-line no-var
  var __sozupayPayoutStore: PayoutRecord[] | undefined;
}

function getStore(): PayoutRecord[] {
  if (!globalThis.__sozupayPayoutStore) {
    globalThis.__sozupayPayoutStore = [];
  }
  return globalThis.__sozupayPayoutStore;
}

const STELLAR_EXPERT_BASE =
  process.env.STELLAR_NETWORK === "public"
    ? "https://stellar.expert/explorer/public"
    : "https://stellar.expert/explorer/testnet";

export function createPayout(
  userId: string,
  amount: string,
  opts: {
    type: "to_bank" | "to_stellar";
    bankAccountId?: string;
    stellarAddress?: string;
    recipientLabel?: string;
  }
): PayoutRecord {
  const id = `payout-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  return ensurePendingPayout(id, userId, amount, opts);
}

/** Idempotent pending record — used when client still has payoutId after server module reload. */
export function ensurePendingPayout(
  id: string,
  userId: string,
  amount: string,
  opts: {
    type: "to_bank" | "to_stellar";
    bankAccountId?: string;
    stellarAddress?: string;
    recipientLabel?: string;
  }
): PayoutRecord {
  const store = getStore();
  const existing = store.find((x) => x.id === id && x.userId === userId);
  if (existing) {
    if (existing.status === "failed") {
      existing.status = "pending";
      existing.amount = amount;
      existing.stellarAddress = opts.stellarAddress ?? existing.stellarAddress;
      existing.recipientLabel = opts.recipientLabel ?? existing.recipientLabel;
    }
    return existing;
  }

  const record: PayoutRecord = {
    id,
    userId,
    amount,
    type: opts.type,
    bankAccountId: opts.bankAccountId,
    stellarAddress: opts.stellarAddress,
    recipientLabel: opts.recipientLabel,
    status: "pending",
    createdAt: new Date().toISOString(),
  };
  store.push(record);
  return record;
}

export function completePayout(id: string, stellarTxHash?: string): void {
  const r = getStore().find((x) => x.id === id);
  if (r) {
    r.status = "completed";
    if (stellarTxHash) r.stellarTxHash = stellarTxHash;
  }
}

export function failPayout(id: string): void {
  const r = getStore().find((x) => x.id === id);
  if (r) r.status = "failed";
}

export function listPayouts(userId: string, limit: number = 50): PayoutRecord[] {
  return getStore()
    .filter((r) => r.userId === userId)
    .sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1))
    .slice(0, limit);
}

export function getPayoutById(id: string, userId: string): PayoutRecord | null {
  const r = getStore().find((x) => x.id === id && x.userId === userId);
  return r ?? null;
}

export function stellarExpertTxUrl(hash: string): string {
  return `${STELLAR_EXPERT_BASE}/tx/${hash}`;
}
