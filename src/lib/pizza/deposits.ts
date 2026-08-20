export type PizzaDepositRow = {
  qrPointId: string;
  amount: number;
};

/** Sum submitted 1-PIZZA redeems for the org and per QR/NFC point. */
export function foldSubmittedPizzaDeposits(rows: PizzaDepositRow[]): {
  orgTotal: number;
  byQrPointId: Record<string, number>;
} {
  const byQrPointId: Record<string, number> = {};
  let orgTotal = 0;
  for (const row of rows) {
    const n = Number(row.amount);
    if (!Number.isFinite(n) || n <= 0) continue;
    orgTotal += n;
    byQrPointId[row.qrPointId] = (byQrPointId[row.qrPointId] ?? 0) + n;
  }
  return { orgTotal, byQrPointId };
}

export function pizzaPayerThanks(pointName: string): { title: string; body: string } {
  const name = pointName.trim() || "the kitchen";
  return {
    title: "Thank you",
    body: `Your pizza is with ${name}. Enjoy it.`,
  };
}

export function pizzaPayerWalletHomeUrl(walletOrigin: string): string {
  const origin = walletOrigin.replace(/\/$/, "") || "https://app.sozu.capital";
  return `${origin}/`;
}
