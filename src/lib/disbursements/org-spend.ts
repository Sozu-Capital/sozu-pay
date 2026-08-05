import type { Organization } from "@/lib/db/organizations";
import type { User } from "@/lib/db/users";
import { appendAuditEvent } from "@/lib/audit";
import {
  appendDisbursementAudit,
  actorLabelFromUser,
  type DisbursementAuditAction,
} from "@/lib/disbursements/store";
import {
  createSpendRequest,
  markSpendRequestExecuted,
  type SpendRequest,
  type SpendRequestPayment,
} from "@/lib/disbursements/spend-requests";
import {
  canServerExecuteOrgSpend,
  createOrgSpendExecutor,
  type OrgSpendExecutor,
} from "@/lib/pollar/spend";
import { isOrgTreasuryOwner } from "@/lib/auth/disbursement-auth";

export type ConfirmOrgSpendInput = {
  org: Organization;
  user: User;
  disbursementId: string;
  payments: SpendRequestPayment[];
  /** Injected for tests; defaults to createOrgSpendExecutor(). */
  executor?: OrgSpendExecutor;
};

export type ConfirmOrgSpendResult =
  | {
      outcome: "executed";
      spendRequest: SpendRequest;
      txHashes: string[];
    }
  | {
      outcome: "queued";
      spendRequest: SpendRequest;
    }
  | {
      outcome: "awaiting_owner_client_tx";
      spendRequest: SpendRequest;
    };

function auditAction(
  disbursementId: string,
  action: DisbursementAuditAction,
  user: User,
  message: string,
  metadata?: Record<string, string>,
) {
  appendDisbursementAudit(disbursementId, {
    action,
    actorUserId: String(user.id),
    actorLabel: actorLabelFromUser(user),
    message,
    metadata,
  });
}

/**
 * Role-gated Disbursement confirmation → Org treasury spend (NO-GO path).
 * - Treasury owner + server-executable (fake): execute immediately
 * - Treasury owner + real Pollar: mark awaiting client DPoP tx
 * - Non-owner with confirm role: enqueue for owner approval
 */
export async function confirmOrgTreasurySpend(
  input: ConfirmOrgSpendInput,
): Promise<ConfirmOrgSpendResult> {
  const { org, user, disbursementId, payments } = input;
  if (payments.length === 0) {
    throw new Error("No payments to confirm");
  }

  const fromAddress = (org.stellar_disbursement_public_key ?? "").trim();
  if (!fromAddress.startsWith("G")) {
    throw new Error("Organization has no Org treasury wallet (classic G) bound");
  }

  const label = actorLabelFromUser(user);
  const isOwner = isOrgTreasuryOwner(user, org);
  const executor = input.executor ?? createOrgSpendExecutor();

  if (!isOwner) {
    const spendRequest = createSpendRequest({
      orgId: org.id,
      disbursementId,
      fromAddress,
      payments,
      requestedByUserId: String(user.id),
      requestedByLabel: label,
      status: "pending",
    });
    auditAction(disbursementId, "spend_queued", user, `Spend queued for treasury owner approval (${payments.length} payment(s))`, {
      spendRequestId: spendRequest.id,
      totalAmount: spendRequest.totalAmount,
    });
    appendAuditEvent(
      "disbursement_spend_queued",
      `User ${label} queued Org treasury spend for ${spendRequest.totalAmount} USDC`,
      String(user.id),
      { amount: spendRequest.totalAmount, signerWallet: fromAddress },
    );
    return { outcome: "queued", spendRequest };
  }

  if (!canServerExecuteOrgSpend() && !input.executor) {
    const spendRequest = createSpendRequest({
      orgId: org.id,
      disbursementId,
      fromAddress,
      payments,
      requestedByUserId: String(user.id),
      requestedByLabel: label,
      status: "awaiting_owner_client_tx",
    });
    auditAction(disbursementId, "spend_confirmed", user, `Owner confirmed; awaiting Pollar custodial session tx`, {
      spendRequestId: spendRequest.id,
    });
    appendAuditEvent(
      "disbursement_spend_confirmed",
      `User ${label} confirmed Org treasury spend (client Pollar session required)`,
      String(user.id),
      { amount: spendRequest.totalAmount, signerWallet: fromAddress },
    );
    return { outcome: "awaiting_owner_client_tx", spendRequest };
  }

  const spendRequest = createSpendRequest({
    orgId: org.id,
    disbursementId,
    fromAddress,
    payments,
    requestedByUserId: String(user.id),
    requestedByLabel: label,
    status: "pending",
  });

  const result = await executor.execute({
    fromAddress,
    actingUserId: String(user.id),
    payments: payments.map((p) => ({
      paymentId: p.paymentId,
      toAddress: p.toAddress,
      amount: p.amount,
      recipientLabel: p.recipientLabel,
    })),
  });

  const executed = markSpendRequestExecuted(
    spendRequest.id,
    { userId: String(user.id), label },
    result.txHashes,
  )!;

  auditAction(disbursementId, "spend_executed", user, `Org treasury spend executed (${result.paymentCount} payment(s))`, {
    spendRequestId: executed.id,
    txHash: result.txHashes[0] ?? "",
  });
  appendAuditEvent(
    "disbursement_spend_executed",
    `User ${label} executed Org treasury spend for ${executed.totalAmount} USDC`,
    String(user.id),
    {
      amount: executed.totalAmount,
      signerWallet: fromAddress,
      stellarTxHash: result.txHashes[0],
      destination: payments[0]?.toAddress,
    },
  );

  return { outcome: "executed", spendRequest: executed, txHashes: result.txHashes };
}

/**
 * Owner approves a queued spend and executes via the Org spend executor.
 */
export async function approveQueuedOrgSpend(input: {
  org: Organization;
  user: User;
  spendRequest: SpendRequest;
  executor?: OrgSpendExecutor;
}): Promise<{ spendRequest: SpendRequest; txHashes: string[] }> {
  const { org, user, spendRequest } = input;
  if (!isOrgTreasuryOwner(user, org)) {
    throw new Error("Only the Org treasury owner can approve spends");
  }
  if (spendRequest.status !== "pending") {
    throw new Error(`Spend request is ${spendRequest.status}, not pending`);
  }
  if (spendRequest.orgId !== org.id) {
    throw new Error("Spend request org mismatch");
  }

  const executor = input.executor ?? createOrgSpendExecutor();
  if (!canServerExecuteOrgSpend() && !input.executor) {
    throw new Error(
      "Approve requires POLLAR_FAKE_AUTH on server, or submit client Pollar txHash after owner confirmation",
    );
  }

  const label = actorLabelFromUser(user);
  const result = await executor.execute({
    fromAddress: spendRequest.fromAddress,
    actingUserId: String(user.id),
    payments: spendRequest.payments,
  });

  const executed = markSpendRequestExecuted(
    spendRequest.id,
    { userId: String(user.id), label },
    result.txHashes,
  )!;

  auditAction(
    spendRequest.disbursementId,
    "spend_executed",
    user,
    `Queued spend approved and executed (${result.paymentCount} payment(s))`,
    { spendRequestId: executed.id, txHash: result.txHashes[0] ?? "" },
  );
  appendAuditEvent(
    "disbursement_spend_executed",
    `User ${label} approved queued Org treasury spend for ${executed.totalAmount} USDC`,
    String(user.id),
    {
      amount: executed.totalAmount,
      signerWallet: spendRequest.fromAddress,
      stellarTxHash: result.txHashes[0],
    },
  );

  return { spendRequest: executed, txHashes: result.txHashes };
}
