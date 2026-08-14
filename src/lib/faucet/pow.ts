import { createHash } from "node:crypto";

/** Must match Sozu Faucet server `POW_PREFIX` (`sozu-faucet-v1`). */
export const SOZU_FAUCET_POW_PREFIX = "sozu-faucet-v1";

export function leadingZeroBits(hexDigest: string): number {
  let bits = 0;
  for (const ch of hexDigest) {
    const n = Number.parseInt(ch, 16);
    if (!Number.isFinite(n)) return bits;
    if (n === 0) {
      bits += 4;
      continue;
    }
    if (n < 2) return bits + 3;
    if (n < 4) return bits + 2;
    if (n < 8) return bits + 1;
    return bits;
  }
  return bits;
}

export function powDigest(params: {
  prefix: string;
  challengeId: string;
  to: string;
  nonce: string;
}): string {
  const payload = `${params.prefix}:${params.challengeId}:${params.to}:${params.nonce}`;
  return createHash("sha256").update(payload).digest("hex");
}

export function verifyPowSolution(params: {
  prefix: string;
  challengeId: string;
  to: string;
  nonce: string;
  difficulty: number;
}): boolean {
  return (
    leadingZeroBits(
      powDigest({
        prefix: params.prefix,
        challengeId: params.challengeId,
        to: params.to,
        nonce: params.nonce,
      }),
    ) >= params.difficulty
  );
}

/** Same solver as `npx @sozu/faucet claim` (Mode C PoW). */
export function solveSozuFaucetPow(params: {
  prefix: string;
  challengeId: string;
  to: string;
  difficulty: number;
}): string {
  let nonce = 0;
  for (;;) {
    const nonceStr = String(nonce);
    if (
      verifyPowSolution({
        prefix: params.prefix,
        challengeId: params.challengeId,
        to: params.to,
        nonce: nonceStr,
        difficulty: params.difficulty,
      })
    ) {
      return nonceStr;
    }
    nonce += 1;
  }
}
