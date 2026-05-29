export type PasskeyLogContext = {
  action: string;
  userId?: number | string;
  disbursementId?: string;
  sessionId?: string;
  reason?: string;
  userAgent?: string;
  details?: Record<string, unknown>;
};

/** Structured passkey / WebAuthn logging for support and debugging. */
export function logPasskeyEvent(level: "info" | "warn" | "error", ctx: PasskeyLogContext) {
  const payload = {
    tag: "passkey",
    level,
    at: new Date().toISOString(),
    ...ctx,
  };
  const line = JSON.stringify(payload);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}
