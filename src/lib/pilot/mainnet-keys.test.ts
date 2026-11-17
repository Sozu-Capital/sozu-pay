import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Keypair } from "@stellar/stellar-sdk";
import {
  assertKeysFileOutsideRepo,
  checkAccount,
  findReusedKeys,
  maxWithdrawableXlm,
  minimumBalanceXlm,
  parseKeysFile,
  PILOT_KEY_SPECS,
  type PilotKeyRole,
} from "./mainnet-keys";

const spec = (role: PilotKeyRole) => PILOT_KEY_SPECS.find((s) => s.role === role)!;
const G = Keypair.random().publicKey();

describe("checkAccount", () => {
  it("tells you how much XLM to send to a missing account", () => {
    const { problems } = checkAccount(spec("escrow"), G, { exists: false });
    assert.equal(problems.length, 1);
    assert.match(problems[0], /send at least 5 XLM/);
  });

  it("needs the full distribution pool plus the smoke-test float", () => {
    const { problems } = checkAccount(spec("distribution"), G, {
      exists: true,
      xlm: 10,
      usdcTrustline: true,
      usdc: 600,
    });
    assert.deepEqual(problems, ["holds 600 USDC, needs 615"]);
  });

  it("passes a funded escrow with a trustline and no USDC", () => {
    const { problems } = checkAccount(spec("escrow"), G, { exists: true, xlm: 5, usdcTrustline: true, usdc: 0 });
    assert.deepEqual(problems, []);
  });

  it("flags a missing trustline and a fee payer that has one", () => {
    assert.match(
      checkAccount(spec("desk_receiving"), G, { exists: true, xlm: 3, usdcTrustline: false, usdc: 0 }).problems[0],
      /no USDC trustline/,
    );
    assert.match(
      checkAccount(spec("fee_payer"), G, { exists: true, xlm: 200, usdcTrustline: true, usdc: 0 }).problems[0],
      /should not need/,
    );
  });
});

describe("findReusedKeys", () => {
  const keys = () =>
    Object.fromEntries(PILOT_KEY_SPECS.map((s) => [s.role, { publicKey: Keypair.random().publicKey() }])) as Record<
      PilotKeyRole,
      { publicKey: string }
    >;

  it("accepts four new distinct keys", () => {
    assert.deepEqual(findReusedKeys(keys(), [G]), []);
  });

  it("rejects a key that equals the testnet funder", () => {
    const k = keys();
    k.fee_payer.publicKey = G;
    assert.match(findReusedKeys(k, [G.toLowerCase()])[0], /fee_payer reuses/);
  });

  it("rejects two roles sharing a key", () => {
    const k = keys();
    k.escrow.publicKey = k.distribution.publicKey;
    assert.match(findReusedKeys(k, [])[0], /escrow and distribution are the same key/);
  });
});

describe("minimumBalanceXlm", () => {
  it("locks 1 XLM on an empty account and 0.5 more per subentry", () => {
    assert.equal(minimumBalanceXlm(0), 1);
    assert.equal(minimumBalanceXlm(1), 1.5);
  });
});

describe("maxWithdrawableXlm", () => {
  it("leaves the reserve and the fee", () => {
    assert.equal(maxWithdrawableXlm(100, 0, 0.00001), 98.9999899);
    assert.equal(maxWithdrawableXlm(2, 0, 0.00001), 0.9999899);
  });

  it("returns zero when only the reserve is left", () => {
    assert.equal(maxWithdrawableXlm(1, 0, 0.00001), 0);
  });
});

describe("assertKeysFileOutsideRepo", () => {
  it("refuses a path inside the repo", () => {
    assert.throws(() => assertKeysFileOutsideRepo("/work/sozu-pay/keys.json", ["/work/sozu-pay"]), /inside the repo/);
    assert.throws(() => assertKeysFileOutsideRepo("/work/sozu-pay", ["/work/sozu-pay"]), /inside the repo/);
  });

  it("allows a sibling path whose name starts with the repo name", () => {
    assert.doesNotThrow(() => assertKeysFileOutsideRepo("/work/sozu-pay-keys.json", ["/work/sozu-pay"]));
    assert.doesNotThrow(() => assertKeysFileOutsideRepo("/home/me/keys.json", ["/work/sozu-pay"]));
  });
});

describe("parseKeysFile", () => {
  it("rejects a testnet file and a missing role", () => {
    assert.throws(() => parseKeysFile(JSON.stringify({ network: "testnet", keys: {} })), /public network/);
    assert.throws(() => parseKeysFile(JSON.stringify({ network: "public", keys: {} })), /missing the distribution key/);
  });
});
