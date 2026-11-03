import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Account, Address, Contract, Keypair, Networks, StrKey, TransactionBuilder, nativeToScVal, xdr } from "@stellar/stellar-sdk";
import { readSorobanPayoutAmounts } from "./envelope-caps";

const passphrase = Networks.TESTNET;
const contractId = () => StrKey.encodeContract(Keypair.random().rawPublicKey());
const disbursement = contractId();
const token = contractId();
const treasury = contractId();
const caller = contractId();
const recipient = Keypair.random().publicKey();
const expected = { disbursementContractId: disbursement, tokenContractId: token };

const addr = (id: string) => Address.fromString(id).toScVal();
const i128 = (v: bigint) => nativeToScVal(v, { type: "i128" });

function envelope(...ops: xdr.Operation[]): string {
  const source = new Account(Keypair.random().publicKey(), "1");
  const builder = new TransactionBuilder(source, { fee: "100", networkPassphrase: passphrase }).setTimeout(60);
  for (const op of ops) builder.addOperation(op);
  return builder.build().toEnvelope().toXDR("base64");
}

const payout = (amount: bigint, target = disbursement) =>
  new Contract(target).call("payout", addr(caller), addr(recipient), i128(amount));
const topUp = (to = disbursement) => new Contract(token).call("transfer", addr(treasury), addr(to), i128(BigInt(5)));

describe("readSorobanPayoutAmounts", () => {
  it("reads the payout amount from the envelope", () => {
    assert.deepEqual(readSorobanPayoutAmounts(envelope(payout(BigInt(1_000_000_000))), passphrase, expected), {
      ok: true,
      amounts: [BigInt(1_000_000_000)],
    });
  });

  it("accepts a treasury top-up into the disbursement contract before the payout", () => {
    const result = readSorobanPayoutAmounts(envelope(topUp(), payout(BigInt(7))), passphrase, expected);
    assert.deepEqual(result, { ok: true, amounts: [BigInt(7)] });
  });

  it("returns every payout so the run total can be capped", () => {
    const result = readSorobanPayoutAmounts(envelope(payout(BigInt(2)), payout(BigInt(3))), passphrase, expected);
    assert.deepEqual(result, { ok: true, amounts: [BigInt(2), BigInt(3)] });
  });

  it("rejects a payout on another contract", () => {
    const result = readSorobanPayoutAmounts(envelope(payout(BigInt(1), contractId())), passphrase, expected);
    assert.equal(result.ok, false);
  });

  it("rejects a token transfer that leaves the disbursement contract", () => {
    const result = readSorobanPayoutAmounts(envelope(topUp(recipient), payout(BigInt(1))), passphrase, expected);
    assert.equal(result.ok, false);
  });

  it("rejects an envelope without a payout", () => {
    assert.equal(readSorobanPayoutAmounts(envelope(topUp()), passphrase, expected).ok, false);
  });

  it("rejects a non-positive payout amount", () => {
    assert.equal(readSorobanPayoutAmounts(envelope(payout(BigInt(0))), passphrase, expected).ok, false);
  });

  it("rejects an unparseable envelope", () => {
    assert.equal(readSorobanPayoutAmounts("not-xdr", passphrase, expected).ok, false);
  });
});
