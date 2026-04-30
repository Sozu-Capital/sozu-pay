# OpenZeppelin Smart Accounts dependencies (pinned)

These are the network-level dependencies required to deploy and operate OpenZeppelin Smart Accounts with WebAuthn (secp256r1) signers.

## Testnet (defaults used for development)

Source: `smart-account-kit` demo `.env.example` (retrieved 2026-04-07).

- **Smart Account WASM hash**: `3e51f5b222dec74650f0b33367acb42a41ce497f72639230463070e666abba2c`
- **WebAuthn verifier contract (C...)**: `CATPTBRWVMH5ZCIKO5HN2F4FMPXVZEXC56RKGHRXCM7EEZGGXK7PICEH`
- **Threshold policy contract (C...)**: `CDDQLFG7CV74QHWPSP6NZIPNBR2PPCMTUVYCJF4P3ONDYHODRFGR7LWC`

## Mainnet

Not set yet. When you are ready to go live:

- Pin a specific `OpenZeppelin/stellar-contracts` release/tag you trust.
- Record the **mainnet** WASM hash + verifier/policy contract IDs.
- Set:
  - `OZ_SMART_ACCOUNT_WASM_HASH_PUBLIC`
  - `OZ_WEBAUTHN_VERIFIER_CONTRACT_ID_PUBLIC`
  - `OZ_THRESHOLD_POLICY_CONTRACT_ID_PUBLIC`

