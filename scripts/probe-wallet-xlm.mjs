#!/usr/bin/env node
/**
 * Probe classic G wallets on Horizon for XLM spendable vs USDC.
 * Usage: node --import tsx scripts/probe-wallet-xlm.mjs G... [G...]
 */
import { Horizon } from "@stellar/stellar-sdk";

const network = process.env.STELLAR_NETWORK === "public" ? "public" : "testnet";
const horizonUrl =
  process.env.HORIZON_URL?.trim() ||
  (network === "public"
    ? "https://horizon.stellar.org"
    : "https://horizon-testnet.stellar.org");
const BASE_RESERVE = 0.5;
const USDC_ISSUER =
  network === "public"
    ? "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4EZN"
    : "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";

const addresses = process.argv.slice(2).filter((a) => a.startsWith("G"));
if (addresses.length === 0) {
  console.error("Usage: node --import tsx scripts/probe-wallet-xlm.mjs G... [G...]");
  process.exit(1);
}

const server = new Horizon.Server(horizonUrl);
console.log(`network=${network} horizon=${horizonUrl}\n`);

for (const address of addresses) {
  try {
    const account = await server.accounts().accountId(address).call();
    const native = account.balances.find((b) => b.asset_type === "native");
    const xlm = native ? parseFloat(native.balance) : 0;
    const usdcRow = account.balances.find(
      (b) =>
        b.asset_type !== "native" &&
        b.asset_code === "USDC" &&
        b.asset_issuer === USDC_ISSUER,
    );
    const usdc = usdcRow ? usdcRow.balance : "0";
    const sub = account.subentry_count ?? 0;
    const min = (2 + sub) * BASE_RESERVE;
    const spendable = Math.max(0, xlm - min);
    console.log(address);
    console.log(`  XLM total:     ${xlm.toFixed(7)}`);
    console.log(`  min reserve:   ${min.toFixed(1)}  (2+${sub} subentries × ${BASE_RESERVE})`);
    console.log(`  XLM spendable: ${spendable.toFixed(7)}`);
    console.log(`  USDC:          ${usdc}`);
    if (spendable < 0.01) {
      console.log("  ⚠ spendable XLM ≈ 0 — this is the usual TX_INSUFFICIENT_FEE cause");
    } else if (spendable < 0.5) {
      console.log("  ⚠ low spendable XLM for Soroban SAC fees");
    }
    console.log("");
  } catch (e) {
    console.log(address);
    console.log(`  ERROR: ${e instanceof Error ? e.message : e}`);
    console.log("");
  }
}
