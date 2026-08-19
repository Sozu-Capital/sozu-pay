# Testnet contract addresses

Single place to record Soroban contract IDs and token addresses used on **testnet**. Update this doc after each deploy or when external addresses are confirmed.

Run `./scripts/deploy-testnet-contracts.sh` (requires `STELLAR_FUNDER_SECRET`) to upload WASM and print env values.

## USDC token (testnet)

Used by the disbursement wallet and (when implemented) vault/Blend integration.

- **Classic issuer (Horizon):** `GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5`
- **Soroban token contract (Stellar Asset Contract):**
  - **Contract ID:** `CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA`
  - Env: `SOROBAN_USDC_TOKEN_ID`

## PizzaToken (testnet SEP-41)

Standing pizza-credit voucher for the Thursday NFC redeem. **Not** Circle USDC — do not reuse `SOROBAN_USDC_TOKEN_ID` / `getCircleUsdcSacContractId()`.

- **Name / symbol / decimals:** Pizza / PIZZA / `0`
- **Flags:** mintable, ownable, not upgradeable, not pausable, not votes
- **Premint:** `20` to owner `GDW4KDAKWDXTTXKBJ3EPUCXQ47JOURDM3QXV623QIBNFFOO7SJT2ZQ3A`
- **Contract ID:** `CDLIQJFEKJ4HGDQ7I5KOAVXOIZLCMVVICRMPK2LL3GE6PL53BQWGS4F6`
- **WASM hash:** `4d80f771784327034902289ecb6209fd06330f6651f7249f5ab60b62dbab9f3b`
- Env: `SOROBAN_PIZZA_TOKEN_ID`
- Deploy: `./scripts/deploy-pizza-token-testnet.sh`
- Explorer: <https://lab.stellar.org/r/testnet/contract/CDLIQJFEKJ4HGDQ7I5KOAVXOIZLCMVVICRMPK2LL3GE6PL53BQWGS4F6>

## Disbursement wallet

One deployment **per org** at onboarding. WASM is uploaded once; each org gets its own contract instance initialized with the creator's member passkey smart account as authorized signer.

| Org / purpose | Contract ID (C...) | Initialized | Notes |
|---------------|--------------------|-------------|--------|
| Per org       | `organizations.soroban_contract_id` | At onboarding | Fund with testnet USDC to enable payouts |

## Shared WASM (testnet)

- **DISBURSEMENT_WALLET_WASM_HASH:** `8c82ffa374bfc538cd8f908dd8baa1ee0b9918262dca5a8e00aadaddb61fb0f6`
- Per-org instances deploy via `POST /api/profile/org/provision-treasury`

## OpenZeppelin smart accounts (passkey)

Used by Smart Account Kit during NGO onboarding.

| Variable | Testnet value |
|----------|---------------|
| `OZ_SMART_ACCOUNT_WASM_HASH_TESTNET` | `3e51f5b222dec74650f0b33367acb42a41ce497f72639230463070e666abba2c` |
| `OZ_WEBAUTHN_VERIFIER_CONTRACT_ID_TESTNET` | `CATPTBRWVMH5ZCIKO5HN2F4FMPXVZEXC56RKGHRXCM7EEZGGXK7PICEH` |
| `OZ_THRESHOLD_POLICY_CONTRACT_ID_TESTNET` | `CDDQLFG7CV74QHWPSP6NZIPNBR2PPCMTUVYCJF4P3ONDYHODRFGR7LWC` |

Also set `SOROBAN_RPC_URL=https://soroban-testnet.stellar.org` and `STELLAR_FUNDER_SECRET` (Friendbot-funded G account).

## Smart account factory (legacy G-signer flow)

Used by [src/lib/stellar/smart-account.ts](../../src/lib/stellar/smart-account.ts) when `SMART_ACCOUNT_FACTORY_ID` is set.

- **Contract ID:** not used in passkey onboarding flow
- See [smart-accounts.md](../01-architecture/smart-accounts.md)

## Blend (external)

We do **not** deploy Blend; we integrate with their testnet deployments.

- **USDC pool / supply entrypoint:** TBD – from [Blend docs](https://docs.blend.capital/)
- **Withdraw entrypoint:** TBD.

## Defindex (external)

- **Testnet strategy / contract addresses:** TBD when integrating.

---

## Blend integration

Blend is a non-custodial lending protocol on Stellar (Soroban). We use it for auto-routing and balancing of org USDC (supply USDC, earn yield). Blend's contracts are deployed by Blend; we only integrate.

**Required for integration:**

- **Testnet contract addresses:** USDC pool (or market), supply entrypoint, withdraw entrypoint.
- **First version:** Backend-only via [src/app/api/vault/route.ts](../../src/app/api/vault/route.ts).
