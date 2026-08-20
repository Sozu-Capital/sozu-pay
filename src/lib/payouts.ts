/**
 * Payout history – in-memory (global singleton survives Next.js dev HMR).
 * Merged with Stellar tx list for display. Off-ramp via adapter.
 */

export interface PayoutRecord {
  id: string;
  userId: string;
  orgId?: string | null;
  amount: string;
  asset?: "USDC" | "PIZZA";
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
    orgId?: string | null;
    asset?: "USDC" | "PIZZA";
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
    orgId?: string | null;
    asset?: "USDC" | "PIZZA";
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
      existing.orgId = opts.orgId ?? existing.orgId;
      existing.asset = opts.asset ?? existing.asset;
    }
    return existing;
  }

  const record: PayoutRecord = {
    id,
    userId,
    orgId: opts.orgId ?? null,
    amount,
    asset: opts.asset,
    type: opts.type,
    bankAccountId: opts.bankAccountId,
    stellarAddress: opts.stellarAddress,
    recipientLabel: opts.recipientLabel,
    status: "pending",
    createdAt: new Date().toISOString(),
  };
  store.push(record);
  void import("@/lib/db/org-payouts")
    .then((db) => db.insertOrgPayout(record))
    .catch((e) => console.error("[payouts] persist insert:", e));
  return record;
}

export function completePayout(id: string, stellarTxHash?: string): void {
  const r = getStore().find((x) => x.id === id);
  if (r) {
    r.status = "completed";
    if (stellarTxHash) r.stellarTxHash = stellarTxHash;
  }
  void import("@/lib/db/org-payouts")
    .then((db) => db.updateOrgPayout(id, { status: "completed", stellarTxHash }))
    .catch((e) => console.error("[payouts] persist complete:", e));
}

export function failPayout(id: string): void {
  const r = getStore().find((x) => x.id === id);
  if (r) r.status = "failed";
  void import("@/lib/db/org-payouts")
    .then((db) => db.updateOrgPayout(id, { status: "failed" }))
    .catch((e) => console.error("[payouts] persist fail:", e));
}

export async function listPayouts(userId: string, limit: number = 50): Promise<PayoutRecord[]> {
  try {
    const { selectOrgPayoutsForUser } = await import("@/lib/db/org-payouts");
    const persisted = await selectOrgPayoutsForUser(userId, limit);
    if (persisted && persisted.length > 0) return persisted;
  } catch (e) {
    console.error("[payouts] persist list:", e);
  }
  return getStore()
    .filter((r) => r.userId === userId)
    .sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1))
    .slice(0, limit);
}

export function getPayoutById(id: string, userId: string): PayoutRecord | null {
  const r = getStore().find((x) => x.id === id && x.userId === userId);
  return r ?? null;
}

export async function getPayoutByIdAsync(id: string, userId: string): Promise<PayoutRecord | null> {
  const mem = getPayoutById(id, userId);
  if (mem) return mem;
  try {
    const { selectOrgPayoutById } = await import("@/lib/db/org-payouts");
    return await selectOrgPayoutById(id, userId);
  } catch (e) {
    console.error("[payouts] persist get:", e);
    return null;
  }
}

export function stellarExpertTxUrl(hash: string): string {
  return `${STELLAR_EXPERT_BASE}/tx/${hash}`;
}
