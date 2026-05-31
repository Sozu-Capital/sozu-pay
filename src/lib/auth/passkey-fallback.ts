/** Whether WebAuthn passkeys can be used in this browser. */
export function isPasskeySupported(): boolean {
  return typeof window !== "undefined" && !!window.PublicKeyCredential;
}

export function isPasskeyUserCancel(err: unknown): boolean {
  if (err instanceof DOMException) {
    return err.name === "NotAllowedError" || err.name === "AbortError";
  }
  const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
  return msg.includes("cancel") || msg.includes("abort");
}

/** Offer Sozu tag + backup PIN only after passkey is unsupported or a real failure (not user cancel). */
export function shouldOfferPinFallback(err: unknown): boolean {
  if (!isPasskeySupported()) return true;
  if (isPasskeyUserCancel(err)) return false;
  const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
  if (msg.includes("not supported")) return true;
  return true;
}
