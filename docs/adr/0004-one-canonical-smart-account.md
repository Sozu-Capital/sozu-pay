# ADR 0004 — One canonical smart account per Sozu account

## Rule

A Sozu account has one smart-account address. Payouts, `$tag` lookup, and the wallet must show that same `C…`.

The address is the first `C…` in `stellar_wallets.public_key` for that user. If the wallet row has no smart account yet, an org treasury `C…` linked by `sozu_tag_auth_user_id` is used and then adopted into the wallet row. After that, the wallet row wins. A different treasury contract is not a second payable address for the same tag.

Tags are case-insensitive. `$FrankOcean` and `frankocean` are one tag. If two profiles already differ only by case, payments use the account whose wallet was created first.

The wallet enforces deploy and registration. This repo enforces directory writes and payout resolution. The shared decision is `selectCanonicalSmartAccount` / `canonicalWriteDecision` in `src/lib/payment/canonical-smart-account.ts`. Wallet ADR 0002 states the same rule.

## Why

On 2026-11-17 a payout of 10 testnet USDC to `$frankocean` succeeded on chain at `CCJY33SG…2KGZ`. That contract belongs to a second profile created on Nov 15. The wallet at dev.sozu.capital resolves the same tag to `CDJVGT46…AZ3F`, the wallet created on Nov 8 for profile `FrankOcean`. Pay lowercased the tag and then preferred the profile whose username matched that lowercase string exactly. Those two spellings are one tag. Payments use the earlier wallet.

## Pay behavior

- `resolvePaymentRecipient` returns the canonical `C…`. A stored smart account is not overridden by `treasury_contract_id` or `soroban_contract_id`.
- A payout whose label is a `$tag` resolves that tag again, even when the client also sent a `C…`. If the submitted contract differs, the canonical one is paid.
- A pasted Stellar address with no tag is paid as written. That is an external destination, not this account's directory.
- `upsertStellarWallet` and `upsertSmartAccount` refuse to replace an existing `C…`.
- Registering an org treasury does not overwrite `organizations.treasury_contract_id` once a `C…` is set.

## Abuse and tamper prevention

Callers can submit any contract id. The server ignores a different one.

| Write | Result when a `C…` already exists |
|-------|-------------------------------------|
| Tag directory sync (`upsertStellarWallet`) | Keeps the stored address. The tag username can still be saved. |
| Member or org-treasury `smart_accounts` upsert | Returns the stored row. The new id is not written. |
| Org treasury register | Does not change `treasury_contract_id` to a different contract. |
| Payout body `destination` plus a `$tag` label | Pays the tag's canonical address, not a stale saved recipient. |

There is no request that rotates a Sozu account onto a new smart account. Moving USDC requires a signature from the passkey on the canonical contract.
