// Build-time shim for `@creit-tech/stellar-wallets-kit`.
// See `next.config.ts` aliases. Not intended for production external wallet use.
export const StellarWalletsKit = {
  init() {},
  async refreshSupportedWallets() {
    return [];
  },
  async authModal() {
    return null;
  },
  async getAddress() {
    return null;
  },
  setWallet() {},
  async disconnect() {},
  selectedModule: null,
};

