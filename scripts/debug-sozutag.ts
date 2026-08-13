/**
 * Debug script to test sozutag resolution
 * Usage: node --import tsx scripts/debug-sozutag.ts $username
 */

import { resolvePaymentRecipient } from "../src/lib/payment/resolve-recipient";

const tag = process.argv[2];

if (!tag) {
  console.error("Usage: node --import tsx scripts/debug-sozutag.ts $username");
  process.exit(1);
}

console.log(`\n🔍 Resolving: ${tag}\n`);

resolvePaymentRecipient(tag)
  .then((result) => {
    if (result.ok) {
      console.log("✅ Resolution succeeded:");
      console.log(JSON.stringify(result.recipient, null, 2));
      console.log(`\nWallet address: ${result.recipient.walletAddress}`);
      console.log(`Payment rail: ${result.recipient.paymentRail}`);
      console.log(`Tag: ${result.recipient.tag || "(none)"}`);
      if (result.recipient.receiveTarget) {
        console.log(`Receive target: ${result.recipient.receiveTarget}`);
      }
    } else {
      console.log("❌ Resolution failed:");
      console.log(`Status: ${result.status}`);
      console.log(`Error: ${result.error}`);
    }
  })
  .catch((err) => {
    console.error("❌ Unexpected error:");
    console.error(err);
  })
  .finally(() => {
    process.exit(0);
  });
