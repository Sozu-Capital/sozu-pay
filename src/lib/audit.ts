/**
 * Audit log: events for dashboard display.
 * In production, persist to DB; here we use in-memory store per process.
 */

export interface PayoutAuditMetadata {
  signerWallet?: string;
  recipientId?: string;
  amount?: string;
  asset?: string;
  stellarTxHash?: string;
  destination?: string;
  recipientLabel?: string;
}

export interface AuditEvent {
  id: string;
  at: string;
  type: string;
  message: string;
  userId?: string;
  metadata?: PayoutAuditMetadata;
}

const store: AuditEvent[] = [];

export function appendAuditEvent(
  type: string,
  message: string,
  userId?: string,
  metadata?: PayoutAuditMetadata
): void {
  store.push({
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    type,
    message,
    userId,
    metadata,
  });
}

export function getAuditEvents(limit: number = 50): AuditEvent[] {
  return [...store].reverse().slice(0, limit);
}
