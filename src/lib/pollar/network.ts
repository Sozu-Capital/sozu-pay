/**
 * Pollar live apps use `pub_mainnet_` keys and Turnkey wallets on Stellar
 * public. The SDK still defaults `stellarNetwork` to `'testnet'`, so production
 * login hangs in wallet setup unless we pass `'mainnet'` explicitly.
 */
export type PollarStellarNetwork = "testnet" | "mainnet";

/** SDK API path prefix. `@pollar/core` 0.12 talks to v3; v2 cannot finish Live/Turnkey wallets. */
export const POLLAR_SDK_API_VERSION = "v3";

const MAINNET_LOGIN_TIMEOUT_MS = 120_000;
const TESTNET_LOGIN_TIMEOUT_MS = 90_000;

export function pollarStellarNetworkFromPublishableKey(
  apiKey: string | null | undefined,
): PollarStellarNetwork | null {
  const key = (apiKey ?? "").trim();
  if (key.startsWith("pub_mainnet_") || key.startsWith("sec_mainnet_")) return "mainnet";
  if (key.startsWith("pub_testnet_") || key.startsWith("sec_testnet_")) return "testnet";
  return null;
}

export function pollarStellarNetworkFromStellarEnv(
  stellarNetwork: string | null | undefined,
): PollarStellarNetwork | null {
  const value = (stellarNetwork ?? "").trim().toLowerCase();
  if (value === "public" || value === "mainnet") return "mainnet";
  if (value === "testnet") return "testnet";
  return null;
}

/**
 * Prefer the Pollar key prefix (what the SDK actually authenticates as).
 * Fall back to NEXT_PUBLIC_STELLAR_NETWORK / STELLAR_NETWORK so a missing
 * prefix still follows the app's Stellar network.
 */
export function resolvePollarStellarNetwork(params: {
  apiKey?: string | null;
  stellarNetwork?: string | null;
} = {}): PollarStellarNetwork {
  return (
    pollarStellarNetworkFromPublishableKey(params.apiKey) ??
    pollarStellarNetworkFromStellarEnv(params.stellarNetwork) ??
    "testnet"
  );
}

/**
 * Next.js inlines `process.env.NEXT_PUBLIC_*` only as a static member
 * expression. Copying `process.env` into a variable and reading
 * `env.NEXT_PUBLIC_POLLAR_PUBLISHABLE_KEY` leaves the browser with
 * `undefined`, so the SDK hashed Turnkey setup txs with the testnet
 * passphrase while the live app issued mainnet envelopes.
 */
function pollarPublicEnv(): {
  apiKey: string | undefined;
  stellarNetwork: string | undefined;
} {
  return {
    apiKey: process.env.NEXT_PUBLIC_POLLAR_PUBLISHABLE_KEY,
    stellarNetwork: process.env.NEXT_PUBLIC_STELLAR_NETWORK ?? process.env.STELLAR_NETWORK,
  };
}

export function pollarStellarNetworkFromEnv(
  env?: NodeJS.Dict<string>,
): PollarStellarNetwork {
  if (env) {
    return resolvePollarStellarNetwork({
      apiKey: env.NEXT_PUBLIC_POLLAR_PUBLISHABLE_KEY,
      stellarNetwork: env.NEXT_PUBLIC_STELLAR_NETWORK ?? env.STELLAR_NETWORK,
    });
  }
  const fromProcess = pollarPublicEnv();
  return resolvePollarStellarNetwork({
    apiKey: fromProcess.apiKey,
    stellarNetwork: fromProcess.stellarNetwork,
  });
}

/** Network for a PollarClient built with this publishable key (already inlined). */
export function pollarStellarNetworkForClient(apiKey: string): PollarStellarNetwork {
  return resolvePollarStellarNetwork({
    apiKey,
    stellarNetwork: pollarPublicEnv().stellarNetwork,
  });
}

export function pollarLoginTimeoutMs(network: PollarStellarNetwork): number {
  return network === "mainnet" ? MAINNET_LOGIN_TIMEOUT_MS : TESTNET_LOGIN_TIMEOUT_MS;
}

export function pollarSdkApiPath(pathname: string): string {
  const trimmed = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return `/${POLLAR_SDK_API_VERSION}${trimmed}`;
}
