/**
 * Fund a new Stellar account (classic G or smart C).
 * Classic G: createAccount operation. Smart C: Payment of XLM to the contract address.
 */

import {
  Asset,
  Keypair,
  Operation,
  TransactionBuilder,
  Horizon,
  Networks,
} from "@stellar/stellar-sdk";

const DEFAULT_STARTING_BALANCE = "2"; // XLM (enough for 1 base reserve + 1 for ops)

/** Top-up target so Pollar/Soroban fees have headroom after trustline reserves. */
export const FEE_BUDGET_MIN_SPENDABLE_XLM = 5;
const FEE_TOP_UP_AMOUNT_XLM = "10";

function getFunderKeypair(): Keypair {
  const funderSecret = process.env.STELLAR_FUNDER_SECRET?.trim();
  if (!funderSecret) {
    throw new Error(
      "STELLAR_FUNDER_SECRET is not set. Set it to the secret key of the account that will fund new users.",
    );
  }
  try {
    return Keypair.fromSecret(funderSecret);
  } catch {
    throw new Error("STELLAR_FUNDER_SECRET is not a valid Stellar secret key.");
  }
}

/**
 * Send native XLM from STELLAR_FUNDER_SECRET to an existing classic G account.
 */
export async function sendNativeXlmFromFunder(
  destinationAccountId: string,
  amount: string,
  server?: Horizon.Server,
): Promise<string> {
  if (!isClassicAccount(destinationAccountId)) {
    throw new Error("sendNativeXlmFromFunder requires a classic G destination");
  }
  const keypair = getFunderKeypair();
  const horizon =
    server ?? (await import("./server").then((m) => m.getHorizon()));
  if (!horizon) throw new Error("Horizon server not available");
  const networkPassphrase = getNetworkPassphrase();
  const sourceAccount = await horizon.loadAccount(keypair.publicKey());
  const txBuilder = new TransactionBuilder(sourceAccount, {
    fee: "100",
    networkPassphrase,
  })
    .addOperation(
      Operation.payment({
        destination: destinationAccountId,
        asset: Asset.native(),
        amount: String(amount),
      }),
    )
    .setTimeout(30);
  const transaction = txBuilder.build();
  transaction.sign(keypair);
  const result = await horizon.submitTransaction(transaction);
  if (result.successful) return result.hash;
  const codes = (result as { result_codes?: unknown }).result_codes;
  throw new Error(
    codes != null ? `Transaction failed: ${JSON.stringify(codes)}` : "Transaction failed",
  );
}

async function friendbotFund(address: string): Promise<string | null> {
  if (process.env.STELLAR_NETWORK === "public") return null;
  const url = `https://friendbot.stellar.org?addr=${encodeURIComponent(address)}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = (await res.json().catch(() => ({}))) as { hash?: string };
  return typeof data.hash === "string" ? data.hash : "friendbot";
}

function getNetworkPassphrase(): string {
  return process.env.STELLAR_NETWORK === "public"
    ? Networks.PUBLIC
    : Networks.TESTNET;
}

/**
 * Returns true if the address is a classic Stellar account (G...).
 * Contract/smart account addresses start with C.
 */
export function isClassicAccount(address: string): boolean {
  return typeof address === "string" && address.startsWith("G");
}

/**
 * Fund a classic account (G...) by submitting a createAccount transaction.
 * Requires STELLAR_FUNDER_SECRET to be set.
 * @param destinationAccountId - The public key (G...) of the account to create and fund
 * @param startingBalance - XLM amount (default 2)
 * @returns Transaction hash or throws on error
 */
export async function fundClassicAccount(
  destinationAccountId: string,
  startingBalance: string = DEFAULT_STARTING_BALANCE,
  server?: Horizon.Server
): Promise<string> {
  if (!isClassicAccount(destinationAccountId)) {
    throw new Error(
      "Only classic accounts (G...) can be funded with createAccount. Smart accounts (C...) use a different flow."
    );
  }

  const keypair = getFunderKeypair();

  const horizon =
    server ?? (await import("./server").then((m) => m.getHorizon()));
  if (!horizon) throw new Error("Horizon server not available");
  const networkPassphrase = getNetworkPassphrase();

  const sourceAccount = await horizon.loadAccount(keypair.publicKey());

  const txBuilder = new TransactionBuilder(sourceAccount, {
    fee: "100",
    networkPassphrase,
  })
    .addOperation(
      Operation.createAccount({
        destination: destinationAccountId,
        startingBalance,
      })
    )
    .setTimeout(30);

  const transaction = txBuilder.build();
  transaction.sign(keypair);

  const result = await horizon.submitTransaction(transaction);
  if (result.successful) {
    return result.hash;
  }
  const codes = (result as { result_codes?: unknown }).result_codes;
  throw new Error(
    codes != null ? `Transaction failed: ${JSON.stringify(codes)}` : "Transaction failed"
  );
}

/**
 * Returns true if the address is a Soroban smart account (C...).
 */
export function isSmartAccount(address: string): boolean {
  return typeof address === "string" && address.startsWith("C");
}

/**
 * Fund a smart account (C...) by sending XLM via Payment from the funder.
 * Requires STELLAR_FUNDER_SECRET. The contract must accept native XLM.
 * @param contractAddress - The smart account address (C...)
 * @param amount - XLM amount (default 2)
 * @returns Transaction hash or throws on error
 */
export async function fundSmartAccount(
  contractAddress: string,
  amount: string = DEFAULT_STARTING_BALANCE,
  server?: Horizon.Server
): Promise<string> {
  if (!isSmartAccount(contractAddress)) {
    throw new Error(
      "Only smart accounts (C...) can be funded with fundSmartAccount. Classic accounts (G...) use fundClassicAccount."
    );
  }

  const funderSecret = process.env.STELLAR_FUNDER_SECRET?.trim();
  if (!funderSecret) {
    throw new Error(
      "STELLAR_FUNDER_SECRET is not set. Set it to the secret key of the account that will fund new users."
    );
  }

  let keypair: Keypair;
  try {
    keypair = Keypair.fromSecret(funderSecret);
  } catch {
    throw new Error("STELLAR_FUNDER_SECRET is not a valid Stellar secret key.");
  }

  const horizon =
    server ?? (await import("./server").then((m) => m.getHorizon()));
  if (!horizon) throw new Error("Horizon server not available");
  const networkPassphrase = getNetworkPassphrase();

  const sourceAccount = await horizon.loadAccount(keypair.publicKey());

  const txBuilder = new TransactionBuilder(sourceAccount, {
    fee: "100",
    networkPassphrase,
  })
    .addOperation(
      Operation.payment({
        destination: contractAddress,
        asset: Asset.native(),
        amount,
      })
    )
    .setTimeout(30);

  const transaction = txBuilder.build();
  transaction.sign(keypair);

  const result = await horizon.submitTransaction(transaction);
  if (result.successful) {
    return result.hash;
  }
  const codes = (result as { result_codes?: unknown }).result_codes;
  throw new Error(
    codes != null ? `Transaction failed: ${JSON.stringify(codes)}` : "Transaction failed"
  );
}

export type EnsureFeeXlmResult = {
  address: string;
  alreadyOk: boolean;
  toppedUp: boolean;
  txHash?: string;
  xlmSpendableBefore: string | null;
  xlmSpendableAfter: string | null;
  method?: "funder_payment" | "funder_create" | "friendbot";
  error?: string;
};

/**
 * Ensure a classic G has spendable XLM for Pollar/network fees.
 * Prefer STELLAR_FUNDER_SECRET payment; testnet falls back to Friendbot.
 * Idempotent when spendable already meets minSpendable.
 */
export async function ensureSpendableXlmForFees(
  address: string,
  minSpendable: number = FEE_BUDGET_MIN_SPENDABLE_XLM,
): Promise<EnsureFeeXlmResult> {
  const { probeClassicWallet } = await import("@/lib/payouts/wallet-health");
  const before = await probeClassicWallet(address, "ensure_fee");
  const spendableBefore = before.xlmSpendable != null ? parseFloat(before.xlmSpendable) : 0;

  if (before.exists && Number.isFinite(spendableBefore) && spendableBefore + 1e-9 >= minSpendable) {
    return {
      address,
      alreadyOk: true,
      toppedUp: false,
      xlmSpendableBefore: before.xlmSpendable,
      xlmSpendableAfter: before.xlmSpendable,
    };
  }

  try {
    let txHash: string;
    let method: EnsureFeeXlmResult["method"];

    if (!before.exists) {
      try {
        txHash = await fundClassicAccount(address, FEE_TOP_UP_AMOUNT_XLM);
        method = "funder_create";
      } catch (err) {
        const fb = await friendbotFund(address);
        if (!fb) throw err;
        txHash = fb;
        method = "friendbot";
      }
    } else {
      try {
        txHash = await sendNativeXlmFromFunder(address, FEE_TOP_UP_AMOUNT_XLM);
        method = "funder_payment";
      } catch (err) {
        const fb = await friendbotFund(address);
        if (!fb) throw err;
        txHash = fb;
        method = "friendbot";
      }
    }

    const after = await probeClassicWallet(address, "ensure_fee");
    return {
      address,
      alreadyOk: false,
      toppedUp: true,
      txHash,
      method,
      xlmSpendableBefore: before.xlmSpendable,
      xlmSpendableAfter: after.xlmSpendable,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      address,
      alreadyOk: false,
      toppedUp: false,
      xlmSpendableBefore: before.xlmSpendable,
      xlmSpendableAfter: before.xlmSpendable,
      error: msg,
    };
  }
}
