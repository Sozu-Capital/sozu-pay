import { Address, FeeBumpTransaction, TransactionBuilder, scValToNative, type Transaction } from "@stellar/stellar-sdk";

export type EnvelopePayouts = { ok: true; amounts: bigint[] } | { ok: false; error: string };

type InvokedCall = { contract: string; fn: string; args: unknown[] };

function invokedCall(op: Transaction["operations"][number]): InvokedCall | null {
  if (op.type !== "invokeHostFunction") return null;
  const func = op.func;
  if (func.switch().name !== "hostFunctionTypeInvokeContract") return null;
  const invoke = func.invokeContract();
  return {
    contract: Address.fromScAddress(invoke.contractAddress()).toString(),
    fn: invoke.functionName().toString(),
    args: invoke.args().map((arg) => scValToNative(arg)),
  };
}

/**
 * Payout amounts (in stroops) carried by a signed disbursement envelope, read from the envelope itself
 * so caps hold even when the client skipped preparation. Only `payout` calls on the org's disbursement
 * contract and USDC top-ups into that contract are accepted; any other operation rejects the envelope.
 */
export function readSorobanPayoutAmounts(
  envelopeXdr: string,
  networkPassphrase: string,
  expected: { disbursementContractId: string; tokenContractId: string },
): EnvelopePayouts {
  let parsed: Transaction | FeeBumpTransaction;
  try {
    parsed = TransactionBuilder.fromXDR(envelopeXdr, networkPassphrase);
  } catch {
    return { ok: false, error: "Could not parse the signed envelope." };
  }
  const tx = parsed instanceof FeeBumpTransaction ? parsed.innerTransaction : parsed;
  const disbursement = expected.disbursementContractId.trim().toUpperCase();
  const token = expected.tokenContractId.trim().toUpperCase();

  const amounts: bigint[] = [];
  for (const op of tx.operations) {
    const call = invokedCall(op);
    if (!call) return { ok: false, error: "Signed envelope contains a non-contract operation." };

    if (call.contract === disbursement && call.fn === "payout" && call.args.length === 3) {
      const amount = call.args[2];
      if (typeof amount !== "bigint" || amount <= BigInt(0)) {
        return { ok: false, error: "Signed payout amount is invalid." };
      }
      amounts.push(amount);
      continue;
    }
    if (call.contract === token && call.fn === "transfer" && call.args.length === 3 && call.args[1] === disbursement) {
      continue;
    }
    return { ok: false, error: "Signed envelope contains an operation other than a disbursement payout." };
  }

  if (amounts.length === 0) return { ok: false, error: "Signed envelope contains no payout." };
  return { ok: true, amounts };
}
