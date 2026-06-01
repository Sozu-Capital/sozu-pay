// Local shim package for `@creit-tech/stellar-wallets-kit`.
// smart-account-kit references this as an optional peer dependency.
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

