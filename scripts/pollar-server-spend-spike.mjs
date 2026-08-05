#!/usr/bin/env node
/**
 * Spike probe: can a Pollar secret key initiate a custodial spend?
 *
 * Usage:
 *   node scripts/pollar-server-spend-spike.mjs
 *   POLLAR_SECRET_KEY=sec_testnet_… POLLAR_PUBLISHABLE_KEY=pub_testnet_… node scripts/pollar-server-spend-spike.mjs
 *
 * Exit 0 always — this is an investigation harness. Prints a GO/NO-GO summary.
 */

const SDK_BASE = process.env.POLLAR_SDK_BASE || "https://sdk.api.pollar.xyz";
const SERVER_BASE = process.env.POLLAR_SERVER_BASE || "https://api.pollar.xyz";
const SEC = process.env.POLLAR_SECRET_KEY || "sec_testnet_invalid";
const PUB = process.env.POLLAR_PUBLISHABLE_KEY || "pub_testnet_invalid";
const DEST =
  process.env.POLLAR_SPIKE_DEST ||
  "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";

async function probe(label, url, { method = "POST", key, body } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (key) headers["x-pollar-api-key"] = key;
  let status = 0;
  let text = "";
  try {
    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    status = res.status;
    text = await res.text();
  } catch (err) {
    text = String(err);
  }
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = text.slice(0, 200);
  }
  console.log(`\n## ${label}`);
  console.log(`${method} ${url}`);
  console.log(`HTTP ${status}`);
  console.log(typeof parsed === "string" ? parsed : JSON.stringify(parsed));
  return { status, parsed };
}

async function main() {
  console.log("Pollar server-spend spike");
  console.log(`SDK_BASE=${SDK_BASE}`);
  console.log(`SERVER_BASE=${SERVER_BASE}`);
  console.log(`Using secret key prefix: ${SEC.slice(0, 12)}…`);
  console.log(`Using publishable key prefix: ${PUB.slice(0, 12)}…`);

  await probe("sdk health", `${SDK_BASE}/v2/health`, { method: "GET" });

  const paymentBody = {
    operation: "payment",
    params: {
      destination: DEST,
      amount: "0.01",
      asset: { type: "native" },
    },
  };

  const secSpend = await probe(
    "custodial spend with SECRET key",
    `${SDK_BASE}/v2/tx/build-sign-submit`,
    { key: SEC, body: paymentBody },
  );

  const pubSpend = await probe(
    "custodial spend with PUBLISHABLE key (no user session)",
    `${SDK_BASE}/v2/tx/build-sign-submit`,
    { key: PUB, body: paymentBody },
  );

  await probe("documented server provision (users/with-wallet)", `${SERVER_BASE}/v1/users/with-wallet`, {
    key: SEC,
    body: { externalId: `org:spike-${Date.now()}` },
  });

  await probe("documented server activate", `${SERVER_BASE}/v1/wallets/activate`, {
    key: SEC,
    body: { publicKey: DEST },
  });

  const secretBlocked =
    secSpend.status === 403 &&
    secSpend.parsed &&
    secSpend.parsed.code === "API_KEY_TYPE_NOT_ALLOWED";

  console.log("\n========== VERDICT ==========");
  if (secretBlocked) {
    console.log(
      "NO-GO (fallback): secret keys cannot call /v2/tx/build-sign-submit (API_KEY_TYPE_NOT_ALLOWED).",
    );
    console.log(
      "Use creator-bound Staff Pollar identity wallet + approval queue; spends require end-user DPoP session.",
    );
  } else {
    console.log(
      "INCONCLUSIVE / unexpected: re-check with real keys. Expected 403 API_KEY_TYPE_NOT_ALLOWED for sec_ on build-sign-submit.",
    );
    console.log(`Observed secret spend: HTTP ${secSpend.status}`, secSpend.parsed);
    console.log(`Observed publishable spend: HTTP ${pubSpend.status}`, pubSpend.parsed);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
