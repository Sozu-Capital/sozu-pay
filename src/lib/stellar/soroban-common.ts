import { Networks, xdr } from "@stellar/stellar-sdk";

const USDC_EXP = 7;

/** Soroban RPC may return retval as base64 or as a parsed ScVal (SDK v14+). */
export function coerceSimulateRetval(raw: unknown): xdr.ScVal | null {
  if (raw == null) return null;
  if (raw instanceof xdr.ScVal) return raw;
  if (typeof raw === "string") {
    try {
      return xdr.ScVal.fromXDR(raw, "base64");
    } catch {
      return null;
    }
  }
  if (
    typeof raw === "object" &&
    raw !== null &&
    "switch" in raw &&
    typeof (raw as xdr.ScVal).switch === "function"
  ) {
    return raw as xdr.ScVal;
  }
  return null;
}

export function getNetworkPassphrase(): string {
  return process.env.STELLAR_NETWORK === "public" ? Networks.PUBLIC : Networks.TESTNET;
}

export function getSorobanRpcUrl(): string {
  const url = process.env.SOROBAN_RPC_URL?.trim();
  if (!url) {
    throw new Error(
      "SOROBAN_RPC_URL is required for Soroban operations (e.g. https://soroban-testnet.stellar.org)."
    );
  }
  return url;
}

export function amountToI128(amount: string): bigint {
  const num = parseFloat(amount);
  if (!Number.isFinite(num) || num < 0) {
    throw new Error(`Invalid amount: ${amount}`);
  }
  return BigInt(Math.round(num * 10 ** USDC_EXP));
}
