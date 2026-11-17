import path from "node:path";
import { Keypair } from "@stellar/stellar-sdk";

/** Protocol base reserve on public and testnet. An empty account must hold two of these. */
export const BASE_RESERVE_XLM = 0.5;

export const MAINNET_USDC_ISSUER = "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN";
export const MAINNET_USDC_SAC = "CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75";
export const MAINNET_HORIZON_URL = "https://horizon.stellar.org";

export type PilotKeyRole = "distribution" | "escrow" | "desk_receiving" | "fee_payer";

export type PilotKeySpec = {
  role: PilotKeyRole;
  /** Where the secret goes. `null` = password manager only; no app ever signs with it. */
  secretEnv: { name: string; project: "sozu-pay" | "sozu-wallet" } | null;
  /** Public address env the other side needs. */
  addressEnv: { name: string; project: "sozu-pay" | "sozu-wallet" } | null;
  usdcTrustline: boolean;
  minXlm: number;
  minUsdc: number;
};

/** 20 beneficiaries × 30 USDC, plus a float for the three-account smoke test. */
export const DISTRIBUTION_POOL_USDC = 600;
export const SMOKE_TEST_FLOAT_USDC = 15;

/**
 * XLM minimums are estimates until the smoke test measures real fees. Each covers its
 * base reserves (1 XLM + 0.5 per trustline) plus headroom for that role's transactions.
 */
export const PILOT_KEY_SPECS: readonly PilotKeySpec[] = [
  {
    role: "distribution",
    secretEnv: { name: "PILOT_DISTRIBUTION_SECRET", project: "sozu-pay" },
    addressEnv: null,
    usdcTrustline: true,
    minXlm: 5,
    minUsdc: DISTRIBUTION_POOL_USDC + SMOKE_TEST_FLOAT_USDC,
  },
  {
    role: "escrow",
    secretEnv: { name: "DESK_ESCROW_SECRET", project: "sozu-pay" },
    addressEnv: { name: "DESK_ESCROW_ADDRESS", project: "sozu-wallet" },
    usdcTrustline: true,
    minXlm: 5,
    minUsdc: 0,
  },
  {
    role: "desk_receiving",
    secretEnv: null,
    addressEnv: { name: "DESK_RECEIVING_ADDRESS", project: "sozu-pay" },
    usdcTrustline: true,
    minXlm: 2,
    minUsdc: 0,
  },
  {
    role: "fee_payer",
    secretEnv: { name: "STELLAR_FUNDER_SECRET", project: "sozu-wallet" },
    addressEnv: null,
    usdcTrustline: false,
    minXlm: 100,
    minUsdc: 0,
  },
];

export type PilotKeysFile = {
  network: "public";
  createdAt: string;
  keys: Record<PilotKeyRole, { publicKey: string; secret: string }>;
};

export type AccountSnapshot =
  | { exists: false }
  | { exists: true; xlm: number; usdcTrustline: boolean; usdc: number };

export type RoleCheck = { role: PilotKeyRole; publicKey: string; problems: string[] };

export function checkAccount(spec: PilotKeySpec, publicKey: string, snap: AccountSnapshot): RoleCheck {
  const problems: string[] = [];
  if (!snap.exists) {
    problems.push(`not on mainnet: send at least ${spec.minXlm} XLM to ${publicKey}`);
    return { role: spec.role, publicKey, problems };
  }
  if (snap.xlm < spec.minXlm) problems.push(`holds ${snap.xlm} XLM, needs ${spec.minXlm}`);
  if (spec.usdcTrustline && !snap.usdcTrustline) problems.push("no USDC trustline: run `setup`");
  if (!spec.usdcTrustline && snap.usdcTrustline) problems.push("has a USDC trustline it should not need");
  if (snap.usdc < spec.minUsdc) problems.push(`holds ${snap.usdc} USDC, needs ${spec.minUsdc}`);
  return { role: spec.role, publicKey, problems };
}

/** Pilot keys must be new: none may equal a testnet funder or each other. */
export function findReusedKeys(
  keys: Record<PilotKeyRole, { publicKey: string }>,
  forbidden: Iterable<string>,
): string[] {
  const problems: string[] = [];
  const banned = new Set([...forbidden].map((k) => k.trim().toUpperCase()));
  const seen = new Map<string, PilotKeyRole>();
  for (const [role, { publicKey }] of Object.entries(keys) as Array<[PilotKeyRole, { publicKey: string }]>) {
    const pk = publicKey.trim().toUpperCase();
    if (banned.has(pk)) problems.push(`${role} reuses an existing testnet or app key (${pk})`);
    const other = seen.get(pk);
    if (other) problems.push(`${role} and ${other} are the same key`);
    seen.set(pk, role);
  }
  return problems;
}

/** Minimum XLM that must stay on the account: (2 + subentries) × base reserve. */
export function minimumBalanceXlm(subentryCount: number): number {
  if (!Number.isInteger(subentryCount) || subentryCount < 0) {
    throw new Error("subentryCount must be a non-negative integer.");
  }
  return (2 + subentryCount) * BASE_RESERVE_XLM;
}

/**
 * XLM that can be paid out while leaving the reserve and the transaction fee.
 * Rounded down to stroops so the payment cannot eat into the reserve.
 */
export function maxWithdrawableXlm(balanceXlm: number, subentryCount: number, feeXlm: number): number {
  if (!Number.isFinite(balanceXlm) || !Number.isFinite(feeXlm) || feeXlm < 0) {
    throw new Error("balance and fee must be finite, and fee cannot be negative.");
  }
  const stroops =
    Math.round(balanceXlm * 1e7) - Math.round(minimumBalanceXlm(subentryCount) * 1e7) - Math.ceil(feeXlm * 1e7);
  return Math.max(0, stroops) / 1e7;
}

/** The keys file holds mainnet secrets; it must never land inside a repo. */
export function assertKeysFileOutsideRepo(keysFile: string, repoRoots: string[]): void {
  const resolved = path.resolve(keysFile);
  for (const root of repoRoots) {
    const rel = path.relative(path.resolve(root), resolved);
    if (rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel))) {
      throw new Error(`Refusing to use ${resolved}: it is inside the repo ${root}. Use a path outside any repo.`);
    }
  }
}

export function parseKeysFile(raw: string): PilotKeysFile {
  const data = JSON.parse(raw) as PilotKeysFile;
  if (data.network !== "public") throw new Error("Keys file is not for the public network.");
  for (const spec of PILOT_KEY_SPECS) {
    const k = data.keys?.[spec.role];
    if (!k?.publicKey?.startsWith("G") || !k.secret?.startsWith("S")) {
      throw new Error(`Keys file is missing the ${spec.role} key.`);
    }
    let derived = "";
    try {
      derived = Keypair.fromSecret(k.secret).publicKey();
    } catch {
      throw new Error(`Keys file has a ${spec.role} secret that cannot sign.`);
    }
    if (derived !== k.publicKey) {
      throw new Error(`Keys file ${spec.role} secret does not match its public address.`);
    }
  }
  return data;
}

export function renderAddressTable(checks: RoleCheck[]): string {
  const rows = checks.map((c) => {
    const spec = PILOT_KEY_SPECS.find((s) => s.role === c.role)!;
    const where = spec.secretEnv
      ? `\`${spec.secretEnv.name}\` (${spec.secretEnv.project} prod)`
      : "password manager only";
    return `| ${c.role} | \`${c.publicKey}\` | ${where} | ${c.problems.length ? "FAIL: " + c.problems.join("; ") : "ok"} |`;
  });
  return ["| Role | Public address | Secret lives in | Check |", "| --- | --- | --- | --- |", ...rows].join("\n");
}
