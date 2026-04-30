/**
 * Stub ramp provider — returns plausible responses without calling any external API.
 * Replace with a real implementation (bridge.ts, circle.ts, etc.) by swapping the
 * export in provider.ts once a vendor is chosen.
 */
import type {
  RampProvider,
  DepositSessionParams,
  DepositSession,
  WithdrawalParams,
  Withdrawal,
  RampWebhookEvent,
} from "./types";

function stubId() {
  return `stub_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export const stubProvider: RampProvider = {
  async createDepositSession(params: DepositSessionParams): Promise<DepositSession> {
    const sessionId = stubId();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    return {
      sessionId,
      url: `${appUrl}/ramp/stub-checkout?ref=${params.externalRef}&session=${sessionId}&amount=${params.amountUsd}&redirect=${encodeURIComponent(params.redirectUrl)}`,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    };
  },

  async createWithdrawal(params: WithdrawalParams): Promise<Withdrawal> {
    const withdrawalId = stubId();
    console.info(
      `[ramp/stub] Withdrawal ${withdrawalId}: ${params.amountUsd} USD from ${params.sourceStellarAddress} to ${params.bankAccount.accountHolderName}`,
    );
    return {
      withdrawalId,
      status: "pending",
      estimatedArrival: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    };
  },

  parseWebhook(rawBody: string, _signature: string): RampWebhookEvent | null {
    try {
      const body = JSON.parse(rawBody) as Record<string, unknown>;
      const type =
        body.type === "deposit.completed" ? "deposit.completed"
        : body.type === "deposit.failed" ? "deposit.failed"
        : body.type === "withdrawal.completed" ? "withdrawal.completed"
        : body.type === "withdrawal.failed" ? "withdrawal.failed"
        : "unknown" as const;
      return {
        type,
        sessionId: String(body.session_id ?? body.sessionId ?? ""),
        externalRef: typeof body.external_ref === "string" ? body.external_ref : undefined,
        amountUsd: typeof body.amount_usd === "string" ? body.amount_usd : undefined,
        occurredAt: typeof body.occurred_at === "string" ? body.occurred_at : new Date().toISOString(),
        raw: body,
      };
    } catch {
      return null;
    }
  },
};
