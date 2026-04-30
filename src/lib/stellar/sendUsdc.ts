/**
 * Send USDC on Stellar to a destination address.
 * Payouts use the **org disbursement wallet** (ORG_DISBURSEMENT_SECRET or
 * STELLAR_DISBURSEMENT_SECRET / STELLAR_FUNDER_SECRET). The super-admin
 * authorizes the payout; the org wallet signs the transaction.
 * Only import this from server code (API routes, server actions).
 */
import {
  Asset,
  Keypair,
  Operation,
  TransactionBuilder,
  Transaction,
  Horizon,
  Networks,
} from "@stellar/stellar-sdk";
import { getHorizon } from "./server";

// Circle USDC: testnet vs public have different issuers (Issuer is invalid if mismatched).
const USDC_ISSUER_TESTNET =
  "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";
const USDC_ISSUER_PUBLIC =
  "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4EZN";

function getUsdcIssuer(): string {
  return process.env.STELLAR_NETWORK === "public"
    ? USDC_ISSUER_PUBLIC
    : USDC_ISSUER_TESTNET;
}

function getNetworkPassphrase(): string {
  return process.env.STELLAR_NETWORK === "public"
    ? Networks.PUBLIC
    : Networks.TESTNET;
}

export function getNetworkName(): "public" | "testnet" {
  return process.env.STELLAR_NETWORK === "public" ? "public" : "testnet";
}

/**
 * Build an unsigned USDC payment envelope (no signature).
 * Used when the client will sign with the org key (e.g. payout password flow).
 */
export async function buildUnsignedUsdcEnvelope(
  sourcePublicKey: string,
  destinationAccountId: string,
  amount: string,
  server?: Horizon.Server
): Promise<{ envelopeXdr: string; networkPassphrase: string; network: "public" | "testnet" }> {
  const horizon = server ?? getHorizon();
  const networkPassphrase = getNetworkPassphrase();
  const usdcAsset = new Asset("USDC", getUsdcIssuer());

  let sourceAccount;
  try {
    sourceAccount = await horizon.loadAccount(sourcePublicKey);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("Not Found") || msg.includes("404")) {
      const network = getNetworkName();
      const friendbot =
        network === "testnet"
          ? ` Fund with one click (testnet): https://friendbot.stellar.org/?addr=${sourcePublicKey}`
          : "";
      throw new Error(
        `Org payout wallet account does not exist on Stellar ${network}. ` +
          `Fund the org disbursement wallet (${sourcePublicKey}) with XLM and USDC first (see Profile).${friendbot}`
      );
    }
    throw err;
  }

  const txBuilder = new TransactionBuilder(sourceAccount, {
    fee: "100",
    networkPassphrase,
  })
    .addOperation(
      Operation.payment({
        destination: destinationAccountId,
        asset: usdcAsset,
        amount: String(amount),
      })
    )
    .setTimeout(30);

  const transaction = txBuilder.build();
  const envelopeXdr = transaction.toEnvelope().toXDR("base64");
  return {
    envelopeXdr,
    networkPassphrase,
    network: getNetworkName(),
  };
}

/** Env vars for org disbursement wallet (order of precedence). */
const ORG_SECRET_ENV_KEYS = [
  "ORG_DISBURSEMENT_SECRET",
  "STELLAR_DISBURSEMENT_SECRET",
  "STELLAR_FUNDER_SECRET",
] as const;

/**
 * Get the org disbursement keypair from env. This is the wallet that holds USDC
 * and signs payout transactions. Super-admin authorizes; this key signs.
 */
function getOrgDisbursementKeypair(): Keypair {
  for (const key of ORG_SECRET_ENV_KEYS) {
    const secret = process.env[key]?.trim();
    if (secret) {
      try {
        return Keypair.fromSecret(secret);
      } catch {
        throw new Error(`${key} is not a valid Stellar secret key.`);
      }
    }
  }
  throw new Error(
    "Org disbursement wallet not configured. Set ORG_DISBURSEMENT_SECRET (or STELLAR_DISBURSEMENT_SECRET / STELLAR_FUNDER_SECRET)."
  );
}

/**
 * Return the org disbursement wallet public key (for Profile / display only).
 * Call only on server; do not expose secret.
 */
export function getOrgDisbursementPublicKey(): string | null {
  for (const key of ORG_SECRET_ENV_KEYS) {
    const secret = process.env[key]?.trim();
    if (secret) {
      try {
        return Keypair.fromSecret(secret).publicKey();
      } catch {
        return null;
      }
    }
  }
  return null;
}

export type SendUsdcOptions = {
  /** When set, this key signs the payment. When unset, org disbursement wallet from env is used. */
  signerSecretKey?: string;
  server?: Horizon.Server;
};

/**
 * Build, sign, and submit a USDC payment to a destination address.
 * Uses org disbursement wallet from env unless signerSecretKey is provided.
 * @param destinationAccountId - Stellar public key (G...) of the recipient
 * @param amount - Amount of USDC to send (string, e.g. "10.5")
 * @param options - signerSecretKey: optional override; server: for tests
 * @returns Transaction hash on success
 */
export async function sendUsdc(
  destinationAccountId: string,
  amount: string,
  options?: SendUsdcOptions | Horizon.Server
): Promise<string> {
  const opts: SendUsdcOptions =
    options && typeof (options as Horizon.Server).submitTransaction !== "function"
      ? (options as SendUsdcOptions)
      : { server: options as Horizon.Server };
  const horizon = opts.server ?? getHorizon();
  const keypair = opts.signerSecretKey
    ? Keypair.fromSecret(opts.signerSecretKey)
    : getOrgDisbursementKeypair();
  const networkPassphrase = getNetworkPassphrase();
  const usdcAsset = new Asset("USDC", getUsdcIssuer());

  const sourcePublicKey = keypair.publicKey();
  let sourceAccount;
  try {
    sourceAccount = await horizon.loadAccount(sourcePublicKey);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("Not Found") || msg.includes("404")) {
      const network = process.env.STELLAR_NETWORK === "public" ? "mainnet" : "testnet";
      const friendbot =
        network === "testnet"
          ? ` Fund with one click (testnet): https://friendbot.stellar.org/?addr=${sourcePublicKey}`
          : "";
      throw new Error(
        `Org payout wallet account does not exist on Stellar ${network}. ` +
        `Fund the org disbursement wallet (${sourcePublicKey}) with XLM and USDC first (see Profile).${friendbot}`
      );
    }
    throw err;
  }

  const txBuilder = new TransactionBuilder(sourceAccount, {
    fee: "100",
    networkPassphrase,
  })
    .addOperation(
      Operation.payment({
        destination: destinationAccountId,
        asset: usdcAsset,
        amount: String(amount),
      })
    )
    .setTimeout(30);

  const transaction = txBuilder.build();
  transaction.sign(keypair);

  let result: { successful?: boolean; hash?: string; result_codes?: unknown };
  try {
    result = await horizon.submitTransaction(transaction);
  } catch (err: unknown) {
    const axiosErr = err as { response?: { status?: number; data?: Record<string, unknown> }; message?: string };
    const body = axiosErr.response?.data;
    let detail = axiosErr.message ?? String(err);
    if (body != null && typeof body === "object") {
      const d = body.detail;
      const extras = body.extras as { result_codes?: { transaction?: string; operations?: string[] } } | undefined;
      const codes = extras?.result_codes;
      if (typeof d === "string") detail = d;
      if (codes) detail += ` [${codes.transaction ?? "tx_failed"}${codes.operations?.length ? `, ops: ${codes.operations.join(", ")}` : ""}]`;
    }
    let hint = "";
    if (detail.includes("op_no_trust")) {
      hint = " Add a USDC trustline to the org disbursement wallet (Stellar Laboratory or a wallet).";
    } else if (detail.includes("op_line_full") || detail.includes("insufficient")) {
      hint = " Not enough USDC balance or trustline limit.";
    }
    throw new Error(`Stellar transaction rejected: ${detail}${hint}`);
  }

  if (result.successful) {
    return result.hash ?? "";
  }
  const codes = (result as { result_codes?: unknown }).result_codes;
  throw new Error(
    codes != null
      ? `Stellar transaction failed: ${JSON.stringify(codes)}`
      : "Stellar transaction failed"
  );
}

/**
 * Submit a signed transaction envelope (client-signed) to Horizon.
 * Used after client signs with payout password.
 */
export async function submitSignedEnvelope(
  envelopeXdr: string,
  networkPassphrase: string,
  server?: Horizon.Server
): Promise<string> {
  const horizon = server ?? getHorizon();
  const transaction = new Transaction(envelopeXdr, networkPassphrase);
  let result: { successful?: boolean; hash?: string; result_codes?: unknown };
  try {
    result = await horizon.submitTransaction(transaction);
  } catch (err: unknown) {
    const axiosErr = err as { response?: { status?: number; data?: Record<string, unknown> }; message?: string };
    const body = axiosErr.response?.data;
    let detail = axiosErr.message ?? String(err);
    if (body != null && typeof body === "object") {
      const d = body.detail;
      const extras = body.extras as { result_codes?: { transaction?: string; operations?: string[] } } | undefined;
      const codes = extras?.result_codes;
      if (typeof d === "string") detail = d;
      if (codes) detail += ` [${codes.transaction ?? "tx_failed"}${codes.operations?.length ? `, ops: ${codes.operations.join(", ")}` : ""}]`;
    }
    let hint = "";
    if (detail.includes("op_no_trust")) {
      hint = " Add a USDC trustline to the org disbursement wallet (Stellar Laboratory or a wallet).";
    } else if (detail.includes("op_line_full") || detail.includes("insufficient")) {
      hint = " Not enough USDC balance or trustline limit.";
    }
    throw new Error(`Stellar transaction rejected: ${detail}${hint}`);
  }
  if (result.successful) {
    return result.hash ?? "";
  }
  const codes = (result as { result_codes?: unknown }).result_codes;
  throw new Error(
    codes != null
      ? `Stellar transaction failed: ${JSON.stringify(codes)}`
      : "Stellar transaction failed"
  );
}
