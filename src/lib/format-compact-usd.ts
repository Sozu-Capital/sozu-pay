/** Compact USD for charts: $28k, $1.2m; hundreds show as whole dollars. */
export function formatCompactUsd(amount: number): string {
  if (!Number.isFinite(amount) || amount <= 0) return "$0";

  if (amount >= 1_000_000) {
    const millions = amount / 1_000_000;
    const rounded = millions >= 10 ? Math.round(millions) : Math.round(millions * 10) / 10;
    return `$${String(rounded).replace(/\.0$/, "")}m`;
  }

  if (amount >= 1_000) {
    const thousands = amount / 1_000;
    const rounded = thousands >= 10 ? Math.round(thousands) : Math.round(thousands * 10) / 10;
    return `$${String(rounded).replace(/\.0$/, "")}k`;
  }

  if (amount >= 100) {
    return `$${Math.round(amount)}`;
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
}
