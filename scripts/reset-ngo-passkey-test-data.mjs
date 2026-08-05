#!/usr/bin/env node
/**
 * One-shot reset of NGO passkey test data for the Pollar clean break.
 *
 * Default is dry-run. Destructive deletes require --confirm.
 *
 * Usage:
 *   node scripts/reset-ngo-passkey-test-data.mjs
 *   node scripts/reset-ngo-passkey-test-data.mjs --org-id=<uuid>
 *   node scripts/reset-ngo-passkey-test-data.mjs --name-prefix=test-
 *   node scripts/reset-ngo-passkey-test-data.mjs --confirm
 *
 * Env (.env.local):
 *   NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * See docs/06-operations/ngo-passkey-test-data-reset.md
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvLocal() {
  const path = resolve(process.cwd(), ".env.local");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

loadEnvLocal();

const args = process.argv.slice(2);
const confirm = args.includes("--confirm");
const orgIdArg = args.find((a) => a.startsWith("--org-id="))?.slice("--org-id=".length);
const namePrefix = args
  .find((a) => a.startsWith("--name-prefix="))
  ?.slice("--name-prefix=".length);

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error(
    "Set NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY in .env.local",
  );
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function isMissingTable(error) {
  const msg = error?.message ?? "";
  return /Could not find the table|schema cache|does not exist/i.test(msg);
}

async function fetchAll(table, columns, filterFn) {
  let q = supabase.from(table).select(columns);
  q = filterFn ? filterFn(q) : q;
  const { data, error } = await q;
  if (error) {
    if (isMissingTable(error)) {
      return { missing: true, rows: [] };
    }
    throw new Error(`${table}: ${error.message}`);
  }
  return { missing: false, rows: data ?? [] };
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function deleteIn(table, column, ids) {
  if (ids.length === 0) return { deleted: 0, missing: false };
  let deleted = 0;
  for (const batch of chunk(ids, 100)) {
    const { error, count } = await supabase
      .from(table)
      .delete({ count: "exact" })
      .in(column, batch);
    if (error) {
      if (isMissingTable(error)) return { deleted: 0, missing: true };
      throw new Error(`delete ${table}: ${error.message}`);
    }
    deleted += count ?? batch.length;
  }
  return { deleted, missing: false };
}

async function main() {
  console.log("NGO passkey test-data reset");
  console.log(confirm ? "MODE: CONFIRM (destructive)" : "MODE: dry-run (pass --confirm to delete)");
  if (orgIdArg) console.log(`Filter: org-id=${orgIdArg}`);
  if (namePrefix) console.log(`Filter: name-prefix=${namePrefix}`);

  const orgsRes = await fetchAll("organizations", "id, name, type", (q) => {
    q = q.eq("type", "ngo");
    if (orgIdArg) q = q.eq("id", orgIdArg);
    if (namePrefix) q = q.ilike("name", `${namePrefix}%`);
    return q;
  });
  const orgs = orgsRes.rows;

  const storeLeak = orgs.filter((o) => o.type !== "ngo");
  if (storeLeak.length > 0) {
    console.error("ABORT: selection included non-ngo orgs:", storeLeak);
    process.exit(1);
  }

  if (orgs.length === 0) {
    console.log("No NGO orgs matched. Nothing to do.");
    return;
  }

  const ngoIds = orgs.map((o) => o.id);
  const ngoIdSet = new Set(ngoIds);
  console.log(`\nTarget NGO orgs (${orgs.length}):`);
  for (const o of orgs) console.log(`  - ${o.id}  ${o.name}`);

  // Membership: prefer org_members when present; always include users.org_id
  const membersRes = await fetchAll("org_members", "id, user_id, org_id, role", (q) =>
    q.in("org_id", ngoIds),
  );
  if (membersRes.missing) {
    console.log("\nNote: public.org_members not present — using users.org_id only.");
  }
  const memberUserIds = membersRes.rows.map((m) => m.user_id);

  const primaryUsersRes = await fetchAll(
    "users",
    "id, email, username, org_id, privy_user_id",
    (q) => q.in("org_id", ngoIds),
  );
  const primaryUsers = primaryUsersRes.rows;
  const candidateUserIds = [
    ...new Set([...memberUserIds, ...primaryUsers.map((u) => u.id)]),
  ];

  // Store orgs — never delete users who still belong to a store
  const storeOrgsRes = await fetchAll("organizations", "id", (q) => q.eq("type", "store"));
  const storeIdSet = new Set(storeOrgsRes.rows.map((o) => o.id));

  const storeMemberUserIds = new Set();
  if (candidateUserIds.length > 0 && storeIdSet.size > 0 && !membersRes.missing) {
    const storeMembersRes = await fetchAll("org_members", "user_id", (q) =>
      q.in("user_id", candidateUserIds).in("org_id", [...storeIdSet]),
    );
    for (const m of storeMembersRes.rows) storeMemberUserIds.add(m.user_id);
  }
  if (candidateUserIds.length > 0) {
    const candRes = await fetchAll("users", "id, org_id", (q) => q.in("id", candidateUserIds));
    for (const u of candRes.rows) {
      if (u.org_id && storeIdSet.has(u.org_id)) storeMemberUserIds.add(u.id);
    }
  }

  const exclusiveUserIds = candidateUserIds.filter((id) => !storeMemberUserIds.has(id));
  const sharedUserIds = candidateUserIds.filter((id) => storeMemberUserIds.has(id));

  const smartAccounts = await fetchAll("smart_accounts", "id, org_id, type", (q) =>
    q.in("org_id", ngoIds),
  );
  const webauthn = await fetchAll("webauthn_credentials", "id, org_id, user_id", (q) =>
    q.in("org_id", ngoIds),
  );
  const signingSessions = await fetchAll("disbursement_signing_sessions", "id, org_id", (q) =>
    q.in("org_id", ngoIds),
  );
  const authPasskeys =
    exclusiveUserIds.length === 0
      ? { missing: false, rows: [] }
      : await fetchAll("auth_passkeys", "id, user_id", (q) => q.in("user_id", exclusiveUserIds));

  console.log("\nPlanned impact:");
  console.log(`  organizations (ngo):              ${orgs.length}`);
  console.log(
    `  org_members (ngo rows):           ${
      membersRes.missing ? "n/a (table missing)" : membersRes.rows.length
    }`,
  );
  console.log(
    `  smart_accounts:                   ${
      smartAccounts.missing ? "n/a" : smartAccounts.rows.length
    }`,
  );
  console.log(
    `  webauthn_credentials (org):       ${webauthn.missing ? "n/a" : webauthn.rows.length}`,
  );
  console.log(
    `  disbursement_signing_sessions:    ${
      signingSessions.missing ? "n/a" : signingSessions.rows.length
    }`,
  );
  console.log(`  exclusive users (delete):         ${exclusiveUserIds.length}`);
  console.log(`  shared users (keep; strip NGO):   ${sharedUserIds.length}`);
  console.log(
    `  auth_passkeys (exclusive users):  ${
      authPasskeys.missing ? "n/a" : authPasskeys.rows.length
    }`,
  );
  console.log(`  store orgs in project (untouched): ${storeIdSet.size}`);

  if (!confirm) {
    console.log("\nDry-run only. Re-run with --confirm to delete.");
    return;
  }

  console.log("\nDeleting…");

  for (const table of [
    "disbursement_signing_sessions",
    "sdp_disbursement_meta",
    "sdp_disbursement_verifications",
    "sdp_beneficiary_sozu_tags",
    "checkout_sessions",
    "org_invites",
    "webauthn_credentials",
    "smart_accounts",
  ]) {
    const { deleted, missing } = await deleteIn(table, "org_id", ngoIds);
    console.log(`  ${table}: ${missing ? "skipped (missing)" : deleted}`);
  }

  if (!membersRes.missing) {
    const { deleted, missing } = await deleteIn("org_members", "org_id", ngoIds);
    console.log(`  org_members: ${missing ? "skipped (missing)" : deleted}`);
  }

  // Clear exclusive/shared users' primary org_id before org delete (FK / soft refs)
  for (const uid of [...exclusiveUserIds, ...sharedUserIds]) {
    const { data: u } = await supabase.from("users").select("id, org_id").eq("id", uid).maybeSingle();
    if (u?.org_id && ngoIdSet.has(u.org_id)) {
      const { error } = await supabase.from("users").update({ org_id: null }).eq("id", uid);
      if (error) throw new Error(`clear org_id user ${uid}: ${error.message}`);
    }
  }

  const orgsDeleted = await deleteIn("organizations", "id", ngoIds);
  console.log(`  organizations: ${orgsDeleted.missing ? "FAILED" : orgsDeleted.deleted}`);
  if (orgsDeleted.missing) throw new Error("organizations table missing — abort");

  const usersDeleted = await deleteIn("users", "id", exclusiveUserIds);
  console.log(`  exclusive users: ${usersDeleted.deleted}`);

  console.log("\nDone. Merchant (store) orgs were not selected.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
