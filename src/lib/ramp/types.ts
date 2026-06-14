/**
 * Provider-agnostic ramp interface.
 * Swap the concrete implementation (src/lib/ramp/provider.ts) for any vendor
 * (Bridge, Circle, Meld, etc.) without touching product code.
 */

export type DepositPaymentMethod = "card" | "bank_transfer";

export type DepositSessionParams = {
  orgId: string;
  /** Amount in USD the customer should pay (informational; provider may let customer choose). */
  amountUsd: string;
  /** Stellar USDC destination address for the settled funds. */
  destinationStellarAddress: string;
  /** Idempotency key – use checkout session ID. */
  externalRef: string;
  /** Full URL the customer is redirected to after provider flow completes. */
  redirectUrl: string;
  /** UI-selected funding rail (passed through to provider / stub checkout). */
  paymentMethod?: DepositPaymentMethod;
};

export type DepositSession = {
  /** Provider-assigned session/order ID. Store this in checkout_sessions. */
  sessionId: string;
  /** URL to redirect the customer to or embed in an iframe. */
  url: string;
  /** ISO timestamp when this session expires (if applicable). */
  expiresAt?: string;
};

export type WithdrawalParams = {
  orgId: string;
  /** Amount in USD to withdraw (must be ≤ available on-chain USDC). */
  amountUsd: string;
  /** Stellar source address the USDC will be swept from. */
  sourceStellarAddress: string;
  /** Idempotency key. */
  externalRef: string;
  bankAccount: {
    accountHolderName: string;
    /** ISO-3166-1 alpha-2 country code. */
    country: string;
    /** Account number or IBAN. */
    accountNumber: string;
    /** Routing / sort / CLABE depending on country. */
    routingCode?: string;
    /** SWIFT/BIC for international wires. */
    swiftCode?: string;
    currency?: string;
  };
};

export type Withdrawal = {
  withdrawalId: string;
  status: "pending" | "processing" | "completed" | "failed";
  estimatedArrival?: string;
};

export type RampWebhookEventType =
  | "deposit.completed"
  | "deposit.failed"
  | "withdrawal.completed"
  | "withdrawal.failed"
  | "unknown";

export type RampWebhookEvent = {
  type: RampWebhookEventType;
  /** Provider session/order ID (maps to checkout_sessions.provider_session_id). */
  sessionId: string;
  /** Idempotency key we sent (maps to checkout_sessions.id or withdrawal external ref). */
  externalRef?: string;
  amountUsd?: string;
  /** ISO timestamp from provider. */
  occurredAt: string;
  /** Stellar transaction hash (for on-chain payments). */
  transactionHash?: string;
  /** Payment method used (card, bank_transfer, sozu). */
  paymentMethod?: "card" | "bank_transfer" | "sozu";
  /** Raw payload from provider. */
  raw: unknown;
};

export type RampProvider = {
  createDepositSession(params: DepositSessionParams): Promise<DepositSession>;
  createWithdrawal(params: WithdrawalParams): Promise<Withdrawal>;
  /**
   * Parse and verify an inbound webhook payload.
   * Returns null if signature is invalid (caller should return 401).
   */
  parseWebhook(rawBody: string, signature: string): RampWebhookEvent | null;
};
