import { FAKE_POLLAR_STAFF_WALLET } from "@/lib/pollar/types";

/**
 * Org treasury spend (NO-GO fallback from ADR-0001 spike).
 * Server secret keys cannot move user funds — execution is either:
 * - Fake executor (tests / POLLAR_FAKE_AUTH)
 * - Owner's authenticated Pollar custodial session on the client (real)
 */

export type OrgSpendPayment = {
  paymentId: string;
  toAddress: string;
  amount: string;
  recipientLabel?: string;
};

export type OrgSpendRequest = {
  fromAddress: string;
  payments: OrgSpendPayment[];
  /** Acting User id for audit attribution. */
  actingUserId: string;
  memo?: string;
};

export type OrgSpendResult = {
  txHashes: string[];
  fromAddress: string;
  paymentCount: number;
};

export interface OrgSpendExecutor {
  /** Debit Org treasury (creator-bound Staff Pollar wallet) for each payment. */
  execute(request: OrgSpendRequest): Promise<OrgSpendResult>;
}

/** Deterministic fake executor for tests and local fake-auth mode. */
export class FakeOrgSpendExecutor implements OrgSpendExecutor {
  readonly calls: OrgSpendRequest[] = [];

  constructor(private readonly defaultFrom: string = FAKE_POLLAR_STAFF_WALLET) {}

  async execute(request: OrgSpendRequest): Promise<OrgSpendResult> {
    if (!request.fromAddress.startsWith("G") || request.fromAddress.length < 56) {
      throw new Error("Org treasury fromAddress must be a classic G-address");
    }
    if (request.payments.length === 0) {
      throw new Error("No payments to execute");
    }
    for (const p of request.payments) {
      if (!p.toAddress || !p.amount) {
        throw new Error("Each payment needs toAddress and amount");
      }
    }
    this.calls.push(request);
    const txHashes = request.payments.map(
      (p, i) => `fake-tx-${request.actingUserId}-${p.paymentId || i}`,
    );
    return {
      txHashes,
      fromAddress: request.fromAddress || this.defaultFrom,
      paymentCount: request.payments.length,
    };
  }
}

/**
 * Production path requires the treasury owner's Pollar DPoP session on the client.
 * This placeholder refuses server-only spend (matches spike NO-GO).
 */
export class ClientBoundOrgSpendExecutor implements OrgSpendExecutor {
  async execute(): Promise<OrgSpendResult> {
    throw new Error(
      "Server cannot spend Org treasury funds with POLLAR_SECRET_KEY. " +
        "Treasury owner must confirm via authenticated Pollar session, or enable POLLAR_FAKE_AUTH for local tests.",
    );
  }
}

export function createOrgSpendExecutor(): OrgSpendExecutor {
  if (process.env.POLLAR_FAKE_AUTH === "true" || process.env.NODE_ENV === "test") {
    return new FakeOrgSpendExecutor();
  }
  return new ClientBoundOrgSpendExecutor();
}

export function canServerExecuteOrgSpend(): boolean {
  return process.env.POLLAR_FAKE_AUTH === "true" || process.env.NODE_ENV === "test";
}
