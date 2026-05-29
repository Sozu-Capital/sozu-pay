#!/usr/bin/env node
/**
 * CLI checks for SDP Railway + SozuCredit E2E (run before push).
 *
 * Usage:
 *   node scripts/sdp-railway-e2e-cli.mjs
 *   SDP_TENANT_NAME=bluecorp node scripts/sdp-railway-e2e-cli.mjs
 *
 * Loads .env.local if present (simple KEY=value parser).
 */

import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { Keypair } from "@stellar/stellar-sdk";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

function loadEnvLocal() {
  const path = join(root, ".env.local");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    if (process.env[k] === undefined) process.env[k] = v;
  }
}

loadEnvLocal();

const SDP_URL = (process.env.SDP_API_URL ?? "https://sdp-v2-production-f6c7.up.railway.app").replace(
  /\/$/,
  ""
);
const TENANT = process.env.SDP_TENANT_NAME ?? "mujeres-admin";
const WALLET = (process.env.SOZUCREDIT_URL ?? "https://credit.sozu.capital").replace(/\/$/, "");
const CLIENT_DOMAIN =
  process.env.SDP_E2E_CLIENT_DOMAIN?.trim() ||
  new URL(WALLET.startsWith("http") ? WALLET : `https://${WALLET}`).hostname;
const SDP_HOST = new URL(SDP_URL).hostname;
const SIGNING_KEY = process.env.SDP_SEP10_SIGNING_KEY ?? "";

let passed = 0;
let failed = 0;

function ok(msg) {
  passed++;
  console.log(`  ✓ ${msg}`);
}
function fail(msg, detail = "") {
  failed++;
  console.log(`  ✗ ${msg}`);
  if (detail) console.log(`    ${detail}`);
}

function encodeQuerySorted(params) {
  const byKey = new Map();
  for (const key of params.keys()) {
    if (!byKey.has(key)) byKey.set(key, params.getAll(key));
  }
  const keys = [...byKey.keys()].sort();
  const parts = [];
  for (const k of keys) {
    for (const v of byKey.get(k) ?? []) {
      parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
    }
  }
  return parts.join("&");
}

function signSdpInviteUrl(walletInviteUrl, assetCode, assetIssuer, sdpDomain, orgName, sep10SigningKey) {
  const asset = assetIssuer ? `${assetCode}-${assetIssuer}` : "native";
  const params = new URLSearchParams();
  params.set("asset", asset);
  params.set("domain", sdpDomain);
  params.set("name", orgName);
  const sortedQs = encodeQuerySorted(params);
  const unsignedUrl = `${walletInviteUrl}?${sortedQs}`;
  const kp = Keypair.fromSecret(sep10SigningKey);
  const sigHex = Buffer.from(kp.sign(Buffer.from(unsignedUrl, "utf8"))).toString("hex");
  return `${unsignedUrl}&signature=${sigHex}`;
}

function augmentSdpInteractiveUrl(url, { tenantName, lang }) {
  const u = new URL(url);
  const tenant = tenantName?.trim();
  if (tenant && !u.searchParams.has("tenant")) u.searchParams.set("tenant", tenant);
  if (lang) u.searchParams.set("lang", lang);
  return u.toString();
}

async function fetchText(url, headers = {}) {
  const res = await fetch(url, { headers });
  const text = await res.text();
  return { res, text };
}

console.log("\n=== SDP Railway E2E CLI ===\n");
console.log(`SDP_API_URL:     ${SDP_URL}`);
console.log(`SDP_TENANT_NAME: ${TENANT}`);
console.log(`SOZUCREDIT_URL:  ${WALLET}`);
console.log(`CLIENT_DOMAIN:   ${CLIENT_DOMAIN}\n`);

// 1 — Wallet TOML
console.log("1. SozuCredit stellar.toml");
try {
  const { res, text } = await fetchText(`${WALLET}/.well-known/stellar.toml`);
  if (res.ok && text.includes('SIGNING_KEY="G')) ok(`TOML HTTP ${res.status}`);
  else fail(`TOML invalid`, `HTTP ${res.status}`);
} catch (e) {
  fail("TOML fetch", e.message);
}

// 2 — SDP TOML
console.log("\n2. SDP anchor stellar.toml");
try {
  const { res, text } = await fetchText(`${SDP_URL}/.well-known/stellar.toml`);
  if (res.ok && text.includes("WEB_AUTH_ENDPOINT")) ok(`SDP TOML HTTP ${res.status}`);
  else fail(`SDP TOML`, `HTTP ${res.status}`);
} catch (e) {
  fail("SDP TOML fetch", e.message);
}

// 3 — Health + tenant
console.log("\n3. SDP health");
try {
  const { res } = await fetchText(`${SDP_URL}/health`, { "SDP-Tenant-Name": TENANT });
  if (res.ok) ok(`health with tenant header HTTP ${res.status}`);
  else fail(`health`, `HTTP ${res.status}`);
} catch (e) {
  fail("health", e.message);
}

// 4 — SEP-10 challenge requires tenant header on Railway
console.log("\n4. SEP-10 challenge (multi-tenant)");
const gKey = "GCZ3KSG2KDJVQKYXSCG3XJBEQYEHUAFOXMEIBJHIO4A7O3JPAWU7CQGZ";
const challengeUrl = `${SDP_URL}/sep10/auth?account=${gKey}&client_domain=${CLIENT_DOMAIN}&home_domain=${SDP_HOST}`;
try {
  const noTenant = await fetchText(challengeUrl, { Accept: "application/json" });
  const withTenant = await fetchText(challengeUrl, {
    Accept: "application/json",
    "SDP-Tenant-Name": TENANT,
  });
  const noJson = JSON.parse(noTenant.text);
  const yesJson = JSON.parse(withTenant.text);
  if (noJson.error && yesJson.transaction) {
    ok("challenge fails without tenant header, succeeds with SDP-Tenant-Name");
  } else {
    fail("SEP-10 tenant behavior unexpected", `no-tenant: ${noTenant.text.slice(0, 80)}`);
  }
} catch (e) {
  fail("SEP-10 challenge", e.message);
}

// 5 — Invite URL signing + tenant param
console.log("\n5. Invite deep link");
if (!SIGNING_KEY) {
  fail("SDP_SEP10_SIGNING_KEY not set in .env.local");
} else {
  try {
    const signed = signSdpInviteUrl(
      `${WALLET.replace(/\/$/, "")}/sdp/invite`,
      "USDC",
      "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
      SDP_HOST,
      "CLI Test Org",
      SIGNING_KEY
    );
    const full = `${signed}&tenant=${encodeURIComponent(TENANT)}`;
    if (full.includes("signature=") && full.includes(`tenant=${encodeURIComponent(TENANT)}`)) {
      ok("signed invite URL includes signature + tenant");
    } else fail("invite URL shape");
  } catch (e) {
    fail("sign invite", e.message);
  }
}

// 6 — augmentSdpInteractiveUrl (tenant + lang=es fix)
console.log("\n6. SEP-24 redirect URL augmentation");
const raw =
  `${SDP_URL}/wallet-registration/start?transaction_id=test-id&token=test-jwt&lang=en`;
const aug = augmentSdpInteractiveUrl(raw, { tenantName: TENANT, lang: "es" });
const u = new URL(aug);
if (u.searchParams.get("tenant") === TENANT && u.searchParams.get("lang") === "es") {
  ok(`tenant=${TENANT}, lang=es appended`);
} else {
  fail("augment URL", aug);
}

// 7 — wallet-registration: wrong tenant should say "Failed to load tenant"
console.log("\n7. wallet-registration tenant resolution");
try {
  const bad = await fetchText(
    `${SDP_URL}/wallet-registration/start?transaction_id=x&token=y&tenant=__nonexistent_tenant__&lang=es`
  );
  const body = JSON.parse(bad.text);
  if (body.error?.includes("tenant")) {
    ok(`bad tenant returns tenant error (not generic 401): ${body.error}`);
  } else if (bad.res.status === 401) {
    ok("invalid token returns 401 (expected without real JWT)");
  } else {
    fail("unexpected response", bad.text.slice(0, 120));
  }
} catch (e) {
  fail("wallet-registration", e.message);
}

console.log(`\n=== ${passed} passed, ${failed} failed ===\n`);
if (failed > 0) {
  console.log("Fix failures before push. Set SDP_TENANT_NAME to match Railway tenant admin.\n");
  process.exit(1);
}
console.log("CLI checks OK. Next: deploy SozuCredit, set SDP_TENANT_NAME on Vercel, browser E2E on /sdp/register.\n");
