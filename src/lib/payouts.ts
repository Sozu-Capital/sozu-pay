/**
 * Payout history – in-memory. Merged with Stellar tx list for display. Off-ramp via adapter.
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

const store: PayoutRecord[] = [];

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
  const r = store.find((x) => x.id === id);
  if (r) {
    r.status = "completed";
    if (stellarTxHash) r.stellarTxHash = stellarTxHash;
  }
}

export function failPayout(id: string): void {
  const r = store.find((x) => x.id === id);
  if (r) r.status = "failed";
}

export function listPayouts(userId: string, limit: number = 50): PayoutRecord[] {
  return store
    .filter((r) => r.userId === userId)
    .sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1))
    .slice(0, limit);
}

export function getPayoutById(id: string, userId: string): PayoutRecord | null {
  const r = store.find((x) => x.id === id && x.userId === userId);
  return r ?? null;
}

export function stellarExpertTxUrl(hash: string): string {
  return `${STELLAR_EXPERT_BASE}/tx/${hash}`;
}
