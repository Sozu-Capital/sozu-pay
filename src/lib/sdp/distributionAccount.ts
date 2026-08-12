import "server-only";

/** SDP distribution account (classic G) — pays batch recipients on-chain. */
export function readDistributionPublicKey(): string {
  const raw =
    (process.env["SDP_DISTRIBUTION_PUBLIC_KEY"] ?? process.env["DISTRIBUTION_PUBLIC_KEY"] ?? "").trim();
  return raw.replace(/^stellar:/i, "");
}

/** Server-only secret for sweep-back (distribution → org treasury). */
export function readDistributionSecret(): string | null {
  const raw =
    process.env.SDP_DISTRIBUTION_SEED?.trim() ||
    process.env.DISTRIBUTION_SEED?.trim() ||
    null;
  return raw || null;
}

export function isDistributionConfigured(): boolean {
  return Boolean(readDistributionPublicKey());
}

export function isDistributionSweepBackEnabled(): boolean {
  return Boolean(readDistributionPublicKey() && readDistributionSecret());
}
