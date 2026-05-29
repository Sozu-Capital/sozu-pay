/**
 * Deploy disbursement_wallet Soroban contract instances (server-only).
 * Requires DISBURSEMENT_WALLET_WASM_HASH and STELLAR_FUNDER_SECRET.
 */
import "server-only";

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { getNetworkPassphrase, getSorobanRpcUrl } from "@/lib/stellar/soroban-common";

const execFileAsync = promisify(execFile);

const CONTRACT_ID_RE = /C[A-Z0-9]{55}/;

export function getDisbursementWasmHash(): string {
  const hash = process.env.DISBURSEMENT_WALLET_WASM_HASH?.trim();
  if (!hash) {
    throw new Error(
      "DISBURSEMENT_WALLET_WASM_HASH is required. Run scripts/deploy-testnet-contracts.sh to upload WASM."
    );
  }
  return hash;
}

function getFunderSecret(): string {
  const secret = process.env.STELLAR_FUNDER_SECRET?.trim();
  if (!secret) throw new Error("STELLAR_FUNDER_SECRET is not configured.");
  return secret;
}

function parseContractId(output: string): string {
  const matches = output.match(new RegExp(CONTRACT_ID_RE.source, "g"));
  if (!matches?.length) {
    throw new Error(`Could not parse contract ID from deploy output: ${output.slice(0, 500)}`);
  }
  return matches[matches.length - 1];
}

/**
 * Deploy a new disbursement_wallet contract instance from the uploaded WASM hash.
 */
export async function deployDisbursementContract(): Promise<string> {
  const wasmHash = getDisbursementWasmHash();
  const source = getFunderSecret();
  const rpcUrl = getSorobanRpcUrl();
  const networkPassphrase = getNetworkPassphrase();

  const { stdout, stderr } = await execFileAsync(
    "stellar",
    [
      "contract",
      "deploy",
      "--wasm-hash",
      wasmHash,
      "--source-account",
      source,
      "--rpc-url",
      rpcUrl,
      "--network-passphrase",
      networkPassphrase,
    ],
    { timeout: 120_000, maxBuffer: 1024 * 1024 }
  );

  return parseContractId(`${stdout}\n${stderr}`);
}
