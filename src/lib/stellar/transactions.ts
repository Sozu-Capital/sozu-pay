import { getHorizon } from "./server";
import { Address, rpc, xdr } from "@stellar/stellar-sdk";
import { coerceSimulateRetval, getSorobanRpcUrl } from "@/lib/stellar/soroban-common";
import { getSorobanUsdcTokenId } from "@/lib/stellar/org-treasury";
import { resolveAddressesToSozuTags } from "@/lib/payment/resolve-address-to-tag";
import { normalizeStellarAddressInput } from "@/lib/payment/stellar-address";

const STELLAR_EXPERT_BASE =
  process.env.STELLAR_NETWORK === "public"
    ? "https://stellar.expert/explorer/public"
    : "https://stellar.expert/explorer/testnet";

export interface TransactionRow {
  id: string;
  date: string;
  amount: string;
  type: "incoming" | "payout" | "yield" | "fee";
  /** Human-readable counterparty: $sozutag or truncated address. */
  source: string;
  counterpartyAddress?: string | null;
  counterpartyTag?: string | null;
  status: "completed" | "pending" | "failed";
  stellarExpertUrl: string;
}

export function stellarExpertTxUrl(txHash: string): string {
  return `${STELLAR_EXPERT_BASE}/tx/${txHash}`;
}

function scValI128ToBigInt(val: xdr.ScVal): bigint {
  if (val.switch().name !== "scvI128") return BigInt(0);
  const parts = val.i128();
  const lo = BigInt(parts.lo().toString());
  const hi = BigInt(parts.hi().toString());
  return (hi << BigInt(64)) + lo;
}

function i128ToDecimalString(amount: bigint, decimals: number): string {
  const negative = amount < BigInt(0);
  const abs = negative ? -amount : amount;
  const divisor = BigInt(10 ** decimals);
  const whole = abs / divisor;
  const frac = abs % divisor;
  const fracStr = frac.toString().padStart(decimals, "0").replace(/0+$/, "");
  const num = fracStr ? `${whole}.${fracStr}` : whole.toString();
  return negative ? `-${num}` : num;
}

function shortAddress(addr: string): string {
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function formatCounterpartySource(tag: string | null | undefined, address: string): string {
  if (tag) return `$${tag.replace(/^\$+/, "")}`;
  return shortAddress(address);
}

function topicScVal(raw: unknown): xdr.ScVal | null {
  return coerceSimulateRetval(raw);
}

type RawTxRow = Omit<TransactionRow, "source"> & {
  source?: string;
  counterpartyAddress: string;
};

async function enrichTransactionRows(rows: RawTxRow[]): Promise<TransactionRow[]> {
  const addresses = rows.map((r) => r.counterpartyAddress).filter(Boolean);
  const tagMap = await resolveAddressesToSozuTags(addresses);
  return rows.map((row) => {
    const addr = normalizeStellarAddressInput(row.counterpartyAddress);
    const tag = tagMap.get(addr) ?? row.counterpartyTag ?? null;
    return {
      ...row,
      counterpartyAddress: addr,
      counterpartyTag: tag,
      source: formatCounterpartySource(tag, addr),
    };
  });
}

async function getSorobanTransferRows(params: {
  holders: string[];
  limit: number;
}): Promise<RawTxRow[]> {
  const holders = new Set(params.holders.map((h) => h.trim().toUpperCase()).filter(Boolean));
  if (holders.size === 0) return [];

  const tokenId = getSorobanUsdcTokenId();
  const rpcUrl = getSorobanRpcUrl();
  const server = new rpc.Server(rpcUrl, { allowHttp: rpcUrl.startsWith("http://") });

  type SorobanEventsRequest = {
    startLedger: number;
    filters: Array<{ type: "contract"; contractIds: string[] }>;
    pagination: { limit: number };
  };
  type SorobanEvent = {
    ledger?: number;
    txHash?: string;
    contractId?: string;
    topic?: unknown[];
    value?: unknown;
  };
  type SorobanEventsResponse = { events?: SorobanEvent[] };
  type RpcServerWithEvents = rpc.Server & {
    getEvents: (req: SorobanEventsRequest) => Promise<SorobanEventsResponse>;
  };

  const latest = await server.getLatestLedger();
  const startLedger = Math.max(1, (latest.sequence ?? 1) - 4000);

  const res = await (server as unknown as RpcServerWithEvents).getEvents({
    startLedger,
    filters: [{ type: "contract", contractIds: [tokenId] }],
    pagination: { limit: Math.min(200, Math.max(40, params.limit * 12)) },
  });

  const events = res?.events ?? [];
  const horizon = getHorizon();
  const dateCache = new Map<string, string>();
  const out: RawTxRow[] = [];
  const seen = new Set<string>();

  for (const ev of events) {
    if (!ev?.txHash || typeof ev.txHash !== "string") continue;
    if (!ev?.topic || !Array.isArray(ev.topic) || ev.topic.length < 3) continue;

    let t0: xdr.ScVal | null = null;
    let from: string | null = null;
    let to: string | null = null;
    try {
      t0 = topicScVal(ev.topic[0]);
      const t1 = topicScVal(ev.topic[1]);
      const t2 = topicScVal(ev.topic[2]);
      if (t1?.switch().name === "scvAddress") from = Address.fromScVal(t1).toString();
      if (t2?.switch().name === "scvAddress") to = Address.fromScVal(t2).toString();
    } catch {
      continue;
    }

    if (!t0 || t0.switch().name !== "scvSymbol" || t0.sym() !== "transfer") continue;
    if (!from || !to) continue;

    const fromU = from.toUpperCase();
    const toU = to.toUpperCase();
    const matchedHolder = [...holders].find((h) => h === fromU || h === toU);
    if (!matchedHolder) continue;

    const dedupeKey = `${ev.txHash}:${fromU}:${toU}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    const val = coerceSimulateRetval(ev.value);
    const amount = val ? i128ToDecimalString(scValI128ToBigInt(val), 7) : "0";
    const isIncoming = toU === matchedHolder;

    let date = "";
    if (dateCache.has(ev.txHash)) {
      date = dateCache.get(ev.txHash)!;
    } else {
      try {
        const tx = (await horizon.transactions().transaction(ev.txHash).call()) as {
          created_at?: string;
        };
        date = String(tx?.created_at ?? "");
      } catch {
        date = "";
      }
      dateCache.set(ev.txHash, date);
    }

    out.push({
      id: ev.txHash,
      date,
      amount,
      type: isIncoming ? "incoming" : "payout",
      counterpartyAddress: isIncoming ? fromU : toU,
      status: "completed",
      stellarExpertUrl: stellarExpertTxUrl(ev.txHash),
    });

    if (out.length >= params.limit * 2) break;
  }

  return out
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, params.limit);
}

export async function getTransactions(
  publicKey: string,
  limit: number = 20,
  options?: { additionalHolders?: string[] }
): Promise<TransactionRow[]> {
  const pk = publicKey.trim().toUpperCase();
  const extra = (options?.additionalHolders ?? [])
    .map((h) => h.trim().toUpperCase())
    .filter((h) => h && h !== pk);

  if (pk.startsWith("C") || extra.some((h) => h.startsWith("C"))) {
    try {
      const holders = [pk, ...extra].filter((h) => h.startsWith("C"));
      const rows = await getSorobanTransferRows({ holders, limit });
      return enrichTransactionRows(rows);
    } catch {
      return [];
    }
  }

  const server = getHorizon();
  const rows: RawTxRow[] = [];
  try {
    const payments = await server
      .payments()
      .forAccount(pk)
      .limit(limit)
      .order("desc")
      .call();

    for (const p of payments.records) {
      const id = p.id ?? p.transaction_hash ?? "";
      const rawDate: unknown = (p as { created_at?: unknown }).created_at;
      const date =
        rawDate instanceof Date ? rawDate.toISOString() : String(rawDate ?? "");
      let amount = "0";
      let type: TransactionRow["type"] = "incoming";
      let counterpartyAddress = "";

      if (p.type === "payment" && "amount" in p) {
        amount = (p as { amount: string }).amount;
        const to = (p as { to?: string }).to?.toUpperCase() ?? "";
        const from = (p as { from?: string }).from?.toUpperCase() ?? "";
        if (to === pk) {
          type = "incoming";
          counterpartyAddress = from;
        } else {
          type = "payout";
          counterpartyAddress = to;
        }
      }

      rows.push({
        id,
        date,
        amount,
        type,
        counterpartyAddress: counterpartyAddress || pk,
        status: "completed",
        stellarExpertUrl: stellarExpertTxUrl(p.transaction_hash),
      });
    }
  } catch {
    /* account not found */
  }
  return enrichTransactionRows(rows);
}
