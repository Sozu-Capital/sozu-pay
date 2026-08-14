/**
 * Classic G account health for payout troubleshooting.
 * Surfaces total vs spendable XLM (reserves eat "has XLM" balances).
 */
import { getHorizon } from "@/lib/stellar/server";
import { getUsdcIssuer } from "@/lib/stellar/balance";

/** Protocol base reserve (XLM). Stellar public/testnet currently use 0.5. */
const BASE_RESERVE_XLM = 0.5;

export type ClassicWalletHealth = {
  address: string;
  role: string;
  exists: boolean;
  network: "testnet" | "public";
  xlmTotal: string | null;
  /** Approximate spendable XLM after (2 + subentries) * base reserve. */
  xlmSpendable: string | null;
  usdc: string | null;
  subentryCount: number | null;
  minBalanceXlm: string | null;
  note?: string;
};

function networkName(): "testnet" | "public" {
  return process.env.STELLAR_NETWORK === "public" ? "public" : "testnet";
}

export async function probeClassicWallet(
  address: string,
  role: string,
): Promise<ClassicWalletHealth> {
  const trimmed = address.trim();
  const base: ClassicWalletHealth = {
    address: trimmed,
    role,
    exists: false,
    network: networkName(),
    xlmTotal: null,
    xlmSpendable: null,
    usdc: null,
    subentryCount: null,
    minBalanceXlm: null,
  };

  if (!trimmed.startsWith("G") || trimmed.length < 56) {
    return { ...base, note: "Not a classic G address" };
  }

  try {
    const account = await getHorizon().accounts().accountId(trimmed).call();
    const native = account.balances.find((b) => b.asset_type === "native");
    const xlmTotal = native && "balance" in native ? parseFloat(native.balance) : 0;
    const issuer = getUsdcIssuer();
    const usdcBal = account.balances.find(
      (b) =>
        b.asset_type !== "native" &&
        "asset_code" in b &&
        b.asset_code === "USDC" &&
        "asset_issuer" in b &&
        b.asset_issuer === issuer,
    );
    const usdc =
      usdcBal && "balance" in usdcBal ? String(usdcBal.balance) : "0";
    const subentryCount = account.subentry_count ?? 0;
    const minBalance = (2 + subentryCount) * BASE_RESERVE_XLM;
    const spendable = Math.max(0, xlmTotal - minBalance);

    let note: string | undefined;
    if (spendable < 0.01) {
      note =
        "Spendable XLM ≈ 0 after reserves. Pollar fees need free XLM (or app sponsorship). Fund more XLM on THIS address.";
    } else if (spendable < 0.5) {
      note =
        "Low spendable XLM — Soroban SAC transfers often need more than a classic payment. Add 2–5 XLM to be safe.";
    }

    return {
      ...base,
      exists: true,
      xlmTotal: xlmTotal.toFixed(7),
      xlmSpendable: spendable.toFixed(7),
      usdc,
      subentryCount,
      minBalanceXlm: minBalance.toFixed(1),
      note,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/not found|404/i.test(msg)) {
      return { ...base, note: "Account does not exist on this network yet" };
    }
    return { ...base, note: `Horizon error: ${msg}` };
  }
}
