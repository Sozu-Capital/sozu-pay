import { Networks } from "@stellar/stellar-sdk";

const USDC_EXP = 7;

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
