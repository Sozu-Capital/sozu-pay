#!/usr/bin/env node
/**
 * Verify Supabase tables required for passkey smart wallets exist.
 * Usage: node scripts/check-smart-account-tables.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(url, key);
const tables = ["webauthn_credentials", "smart_accounts", "org_invites"];

let missing = 0;
for (const table of tables) {
  const { error } = await supabase.from(table).select("id").limit(1);
  if (error) {
    console.error(`✗ ${table}: ${error.message}`);
    missing++;
  } else {
    console.log(`✓ ${table}`);
  }
}

if (missing > 0) {
  console.log("\nRun this SQL in Supabase → SQL Editor:");
  console.log("  docs/07-reference/supabase-smart-accounts.sql\n");
  process.exit(1);
}

console.log("\nAll passkey smart-account tables are present.");
