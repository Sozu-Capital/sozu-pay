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

async function fetchAll(table, columns, filterFn) {
  let q = supabase.from(table).select(columns);
  q = filterFn ? filterFn(q) : q;
  const { data, error } = await q;
  if (error) throw new Error(`${table}: ${error.message}`);
  return data ?? [];
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function deleteIn(table, column, ids) {
  if (ids.length === 0) return 0;
  let deleted = 0;
  for (const batch of chunk(ids, 100)) {
    const { error, count } = await supabase
      .from(table)
      .delete({ count: "exact" })
      .in(column, batch);
    if (error) throw new Error(`delete ${table}: ${error.message}`);
    deleted += count ?? batch.length;
  }
  return deleted;
}

async function main() {
  console.log("NGO passkey test-data reset");
  console.log(confirm ? "MODE: CONFIRM (destructive)" : "MODE: dry-run (pass --confirm to delete)");
  if (orgIdArg) console.log(`Filter: org-id=${orgIdArg}`);
  if (namePrefix) console.log(`Filter: name-prefix=${namePrefix}`);

  let orgs = await fetchAll("organizations", "id, name, type", (q) => {
    q = q.eq("type", "ngo");
    if (orgIdArg) q = q.eq("id", orgIdArg);
    if (namePrefix) q = q.ilike("name", `${namePrefix}%`);
    return q;
  });

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
  console.log(`\nTarget NGO orgs (${orgs.length}):`);
  for (const o of orgs) console.log(`  - ${o.id}  ${o.name}`);

  const members = await fetchAll("org_members", "id, user_id, org_id, role", (q) =>
    q.in("org_id", ngoIds),
  );
  const memberUserIds = [...new Set(members.map((m) => m.user_id))];

  const primaryUsers = await fetchAll("users", "id, email, username, org_id, privy_user_id", (q) =>
    q.in("org_id", ngoIds.map(String)),
  );
  // users.org_id is text in schema; also try uuid form
  const candidateUserIds = [
    ...new Set([...memberUserIds, ...primaryUsers.map((u) => u.id)]),
  ];

  // Store memberships for candidates (must keep those users)
  let storeMemberUserIds = new Set();
  if (candidateUserIds.length > 0) {
    const { data: storeOrgs, error: storeOrgErr } = await supabase
      .from("organizations")
      .select("id")
      .eq("type", "store");
    if (storeOrgErr) throw new Error(`store orgs: ${storeOrgErr.message}`);
    const storeIds = (storeOrgs ?? []).map((o) => o.id);
    if (storeIds.length > 0) {
      const { data: storeMembers, error: smErr } = await supabase
        .from("org_members")
        .select("user_id")
        .in("user_id", candidateUserIds)
        .in("org_id", storeIds);
      if (smErr) throw new Error(`store members: ${smErr.message}`);
      storeMemberUserIds = new Set((storeMembers ?? []).map((m) => m.user_id));
    }
    // Also: users whose primary org_id points at a store
    const { data: storePrimary, error: spErr } = await supabase
      .from("users")
      .select("id, org_id")
      .in("id", candidateUserIds);
    if (spErr) throw new Error(`users primary: ${spErr.message}`);
    const storeIdSet = new Set(storeIds);
    for (const u of storePrimary ?? []) {
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

  let signingSessions = [];
  try {
    signingSessions = await fetchAll(
      "disbursement_signing_sessions",
      "id, org_id",
      (q) => q.in("org_id", ngoIds.map(String)),
    );
  } catch (err) {
    console.warn(`(skip signing sessions) ${err.message}`);
  }

  let authPasskeys = [];
  if (exclusiveUserIds.length > 0) {
    try {
      authPasskeys = await fetchAll("auth_passkeys", "id, user_id", (q) =>
        q.in("user_id", exclusiveUserIds),
      );
    } catch (err) {
      console.warn(`(skip auth_passkeys) ${err.message}`);
    }
  }

  console.log("\nPlanned impact:");
  console.log(`  organizations (ngo):              ${orgs.length}`);
  console.log(`  org_members (ngo rows):           ${members.length}`);
  console.log(`  smart_accounts:                   ${smartAccounts.length}`);
  console.log(`  webauthn_credentials (org):       ${webauthn.length}`);
  console.log(`  disbursement_signing_sessions:    ${signingSessions.length}`);
  console.log(`  exclusive users (delete):         ${exclusiveUserIds.length}`);
  console.log(`  shared users (keep; strip NGO):   ${sharedUserIds.length}`);
  console.log(`  auth_passkeys (exclusive users):  ${authPasskeys.length}`);

  if (!confirm) {
    console.log("\nDry-run only. Re-run with --confirm to delete.");
    return;
  }

  console.log("\nDeleting…");

  // Soft-FK / text org_id tables first
  const ssDeleted = await deleteIn(
    "disbursement_signing_sessions",
    "org_id",
    ngoIds.map(String),
  );
  console.log(`  disbursement_signing_sessions: ${ssDeleted}`);

  // Optional SDP meta (ignore if missing)
  for (const table of [
    "sdp_disbursement_meta",
    "sdp_disbursement_verifications",
    "sdp_beneficiary_sozu_tags",
    "checkout_sessions",
    "org_invites",
  ]) {
    try {
      const n = await deleteIn(table, "org_id", ngoIds);
      console.log(`  ${table}: ${n}`);
    } catch (err) {
      console.warn(`  ${table}: skipped (${err.message})`);
    }
  }

  // Org delete cascades org_members, smart_accounts, webauthn_credentials (org FK)
  const orgsDeleted = await deleteIn("organizations", "id", ngoIds);
  console.log(`  organizations: ${orgsDeleted}`);

  // Strip shared users' primary org_id if it pointed at deleted NGO
  for (const uid of sharedUserIds) {
    const { data: u } = await supabase.from("users").select("id, org_id").eq("id", uid).maybeSingle();
    if (u?.org_id && ngoIds.includes(u.org_id)) {
      const { error } = await supabase.from("users").update({ org_id: null }).eq("id", uid);
      if (error) throw new Error(`clear org_id user ${uid}: ${error.message}`);
    }
  }
  console.log(`  shared users org_id cleared if needed: ${sharedUserIds.length}`);

  // Delete exclusive users (cascades auth_passkeys / user-owned rows)
  const usersDeleted = await deleteIn("users", "id", exclusiveUserIds);
  console.log(`  exclusive users: ${usersDeleted}`);

  console.log("\nDone. Merchant (store) orgs were not selected.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
