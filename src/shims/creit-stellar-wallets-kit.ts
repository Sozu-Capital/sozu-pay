/**
 * Build-time shim for `@creit-tech/stellar-wallets-kit`.
 *
 * The real package is a peer dep of `smart-account-kit` and isn't published to npm
 * in our environment. We don't use external wallet adapters in SozuPay dashboard,
 * but Next.js still tries to resolve the module during bundling.
 *
 * This shim is only meant to satisfy module resolution; runtime code paths that
 * truly require StellarWalletsKit should install the real dependency.
 */
export const StellarWalletsKit = {
  init: () => {},
  refreshSupportedWallets: async () => [],
  authModal: async () => null,
  getAddress: async () => null,
  setWallet: () => {},
  disconnect: async () => {},
  selectedModule: null as null | { productId?: string; productName?: string },
};

