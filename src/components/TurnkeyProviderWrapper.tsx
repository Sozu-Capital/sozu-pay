"use client";

/**
 * Turnkey integration is not active in this deployment.
 * The @turnkey/react-wallet-kit package is not installed.
 * This wrapper is a no-op passthrough — Turnkey can be re-enabled by
 * installing the package and restoring the full implementation.
 */
export function TurnkeyProviderWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
