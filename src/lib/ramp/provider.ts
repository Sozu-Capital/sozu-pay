/**
 * Returns the active ramp provider singleton.
 * Switch the import here (and set RAMP_PROVIDER env var) to go from stub → real vendor.
 *
 * RAMP_PROVIDER=stub  → stubProvider (default; for development and demos)
 * RAMP_PROVIDER=bridge → bridgeProvider  (add src/lib/ramp/bridge.ts when ready)
 */
import { stubProvider } from "./stub";
import type { RampProvider } from "./types";

function getProvider(): RampProvider {
  const name = process.env.RAMP_PROVIDER ?? "stub";
  switch (name) {
    case "stub":
      return stubProvider;
    default:
      console.warn(`[ramp] Unknown RAMP_PROVIDER "${name}", falling back to stub.`);
      return stubProvider;
  }
}

export const rampProvider: RampProvider = getProvider();
export type { RampProvider } from "./types";
export type {
  DepositSession,
  DepositSessionParams,
  Withdrawal,
  WithdrawalParams,
  RampWebhookEvent,
  RampWebhookEventType,
} from "./types";
