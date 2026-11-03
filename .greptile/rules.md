# Review context: SozuPay dashboard

SozuPay is the operator dashboard for the Mujeres 2000 mainnet pilot. Organizations hold USDC on Stellar and pay beneficiaries through the `disbursement_wallet` Soroban contract. Real money moves on mainnet, so prioritize correctness and security findings over style.

## What matters most

- Custody: mainnet distribution, escrow, desk and fee-payer keys live only in Vercel production env. No API or UI may reveal a key.
- Payouts: per-payout and per-run caps are enforced in code and on-chain; a payout that skips the caps is a critical bug.
- Authorization: org-scoped actions check the session user's role in that org.
- Network: code must behave correctly on both `STELLAR_NETWORK=testnet` and `public`; flag testnet-only shortcuts (Friendbot, testnet funder, hardcoded testnet contract IDs) that could run on mainnet.

## Conventions

- Tests run with `node --import tsx --test` and must be listed in the `test` script in `package.json`.
- PRs target `dev`.
