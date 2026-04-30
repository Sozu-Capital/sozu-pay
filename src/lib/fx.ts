/**
 * Simple FX helper: fetch a daily USD → target currency rate.
 * Uses the ECB/Open Exchange Rate via the free api.frankfurter.app API.
 * Falls back to 1:1 (USD) if the fetch fails or the currency is USD.
 *
 * Set LOCAL_FIAT_CURRENCY=MXN (or CLP, ARS, etc.) in .env.local to
 * show the "today's local value" figure on the store balance screen.
 */

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

type FxCache = { rate: number; currency: string; fetchedAt: number };
let cache: FxCache | null = null;

export function getLocalFiatCurrency(): string {
  return (process.env.LOCAL_FIAT_CURRENCY ?? "USD").toUpperCase();
}

export async function getUsdToLocalRate(): Promise<{ rate: number; currency: string; source: string }> {
  const currency = getLocalFiatCurrency();

  if (currency === "USD") {
    return { rate: 1, currency: "USD", source: "1 USDC = 1 USD" };
  }

  const now = Date.now();
  if (cache && cache.currency === currency && now - cache.fetchedAt < CACHE_TTL_MS) {
    return { rate: cache.rate, currency, source: `1 USD ≈ ${cache.rate.toFixed(2)} ${currency} (Frankfurter)` };
  }

  try {
    const res = await fetch(`https://api.frankfurter.app/latest?from=USD&to=${currency}`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) throw new Error(`Status ${res.status}`);
    const data = await res.json() as { rates: Record<string, number> };
    const rate = data.rates[currency];
    if (!rate || !isFinite(rate)) throw new Error("Invalid rate");
    cache = { rate, currency, fetchedAt: now };
    return { rate, currency, source: `1 USD ≈ ${rate.toFixed(2)} ${currency} (Frankfurter)` };
  } catch (err) {
    console.warn(`[fx] Failed to fetch ${currency} rate:`, err);
    return { rate: 1, currency: "USD", source: "1 USDC = 1 USD" };
  }
}

export function convertUsdToLocal(usdAmount: number, rate: number): string {
  return (usdAmount * rate).toFixed(2);
}
