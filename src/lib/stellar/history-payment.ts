/** A Horizon payments-feed operation, narrowed to the fields history cares about. */
export type HorizonHistoryOperation = {
  type?: string;
  id?: string;
  transaction_hash?: string;
  created_at?: string | Date;
  amount?: string;
  asset_type?: string;
  asset_code?: string;
  from?: string;
  to?: string;
  asset_balance_changes?: HorizonAssetBalanceChange[];
};

export type HorizonAssetBalanceChange = {
  type?: string;
  asset_code?: string;
  asset_type?: string;
  amount?: string;
  from?: string;
  to?: string;
};

export type HistoryMovement = {
  /** Transaction hash, so a contract call and its Soroban event collapse to one row. */
  id: string;
  date: string;
  amount: string;
  type: "incoming" | "payout";
  counterpartyAddress: string;
};

const USDC_CODES = new Set(["USDC", "USD"]);

export function isPositiveAmount(amount: string | null | undefined): boolean {
  if (!amount) return false;
  const n = Number(amount);
  return Number.isFinite(n) && n > 0;
}

function isUsdc(assetCode?: string): boolean {
  return USDC_CODES.has((assetCode ?? "").toUpperCase());
}

function operationDate(raw: string | Date | undefined): string {
  if (raw instanceof Date) return raw.toISOString();
  return typeof raw === "string" ? raw : "";
}

function direction(
  account: string,
  from: string | undefined,
  to: string | undefined,
): { type: "incoming" | "payout"; counterpartyAddress: string } | null {
  const accountU = account.toUpperCase();
  const fromU = (from ?? "").toUpperCase();
  const toU = (to ?? "").toUpperCase();
  if (toU === accountU && fromU) return { type: "incoming", counterpartyAddress: fromU };
  if (fromU === accountU && toU) return { type: "payout", counterpartyAddress: toU };
  return null;
}

/**
 * Turn one Horizon payments record into a USDC history row.
 * Account creation, XLM funding, and contract calls with no USDC movement return null.
 */
export function historyMovementFromOperation(
  op: HorizonHistoryOperation,
  account: string,
): HistoryMovement | null {
  const txHash = op.transaction_hash?.trim();
  if (!txHash) return null;
  const date = operationDate(op.created_at);

  if (op.type === "payment" || op.type === "path_payment_strict_receive" || op.type === "path_payment_strict_send") {
    if (!isUsdc(op.asset_code) || !isPositiveAmount(op.amount)) return null;
    const way = direction(account, op.from, op.to);
    if (!way) return null;
    return { id: txHash, date, amount: op.amount!.trim(), ...way };
  }

  if (op.type === "invoke_host_function") {
    for (const change of op.asset_balance_changes ?? []) {
      if (change.type !== "transfer" || !isUsdc(change.asset_code) || !isPositiveAmount(change.amount)) {
        continue;
      }
      const way = direction(account, change.from, change.to);
      if (!way) continue;
      return { id: txHash, date, amount: change.amount!.trim(), ...way };
    }
  }

  return null;
}
