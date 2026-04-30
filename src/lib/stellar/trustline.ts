/**
 * Build unsigned Stellar changeTrust (USDC trustline) for a given account.
 * Used so the user can sign client-side with their wallet (no server-held secret).
 */
import {
  Asset,
  Operation,
  TransactionBuilder,
  Networks,
} from "@stellar/stellar-sdk";
import { getHorizon } from "./server";

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

export type BuildTrustlineTxResult = {
  envelopeXdr: string;
  network: "testnet" | "public";
  networkPassphrase: string;
};

/**
 * Build an unsigned changeTrust transaction for the given account (G...).
 * Returns envelope XDR (base64) and network info for client-side signing.
 */
export async function buildTrustlineTransaction(
  accountPublicKey: string
): Promise<BuildTrustlineTxResult> {
  const horizon = getHorizon();
  const networkPassphrase = getNetworkPassphrase();
  const network =
    process.env.STELLAR_NETWORK === "public" ? "public" : "testnet";

  const sourceAccount = await horizon.loadAccount(accountPublicKey);
  const usdcAsset = new Asset("USDC", getUsdcIssuer());

  const transaction = new TransactionBuilder(sourceAccount, {
    fee: "100",
    networkPassphrase,
  })
    .addOperation(
      Operation.changeTrust({
        asset: usdcAsset,
        limit: "1000000000", // 1B USDC limit
      })
    )
    .setTimeout(30)
    .build();

  const envelopeXdr = transaction.toEnvelope().toXDR("base64");
  return { envelopeXdr, network, networkPassphrase };
}
