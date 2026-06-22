# Week Changelog & Release Notes (sozupay 0.3 + sozu wallet 0.3)

**Week:** Monday 8 June — Sunday 14 June 2026 (inclusive)  
**Repos:** [sozupay_mvp](https://github.com/blessedux/sozupay_mvp) (SozuPay Merchant/NGO Dashboard — this tree) · [SozuCredit](https://github.com/blessedux/SozuCredit) (Sozu Wallet, passkeys, Stellar/Soroban)  
**Releases:** **sozupay 0.3** and **sozu wallet 0.3**

---

## Executive Summary

This week, we achieved a significant milestone in bridging the merchant checkout experience with self-custodial consumer wallets on Stellar & Soroban. We shipped the first iteration of the **Merchant Commerce Layer** alongside **Sozu Wallet 0.3** and **SozuPay 0.3**, featuring dynamic smart account treasury routing, native WebAuthn (Passkeys) transaction signing for payments, on-chain Soroban RPC verification, and a testnet token Faucet MVP with NFC support.

| App / Repo | Version | Key Achievements Shipped This Week |
| :--- | :--- | :--- |
| **sozupay_mvp** (Dashboard) | **sozupay 0.3** | Merchant onboarding, landing, dynamic checkout creation, POS QR code generation (session IDs), Soroban RPC event-based payment verification, clickable Receipts/ReceiptModal, WebAuthn RP ID domain matching, and webhook logging. |
| **SozuCredit** (Wallet) | **sozu wallet 0.3** | Sozu Faucet testnet MVP (NFC-triggered claim, vault contract), interactive checkout screens with WebAuthn/Passkey signatures, dynamic merchant smart account routing, QR scanner parsing for POS session IDs/redirects, and post-payment ledger refresh. |

---

## Architecture & Integration Highlights (Cross-Repo)

### 1. Dynamic Org Treasury Smart Account Routing
Instead of relying on hardcoded destination addresses or classic Stellar `G...` wallets, the checkout flow now dynamically queries the organization's configuration database to retrieve their treasury smart account address (`C...`). The wallet intercepts the payment request and overrides the destination, guaranteeing that funds flow directly into the merchant's secure, self-custodial smart contract vault.

### 2. POS Checkout Session QR Codes & Scanner Redirections
We established an end-to-end POS workflow:
* The merchant generates a dynamic payment request via the **Cobrar** tab in SozuPay, displaying a QR code loaded with a checkout session ID and short-link.
* The Sozu Wallet QR scanner was enhanced to parse these specific POS session IDs and slugs, instantly redirecting the payer to a native checkout interface within the wallet.

### 3. WebAuthn RP ID Alignment on Merchant Domains
To support white-labeled and custom merchant checkout domains, we resolved the WebAuthn Relying Party (RP) ID mismatch. When a user authorizes a payment on a custom domain, the RP ID is correctly mapped to prevent authenticator validation errors, ensuring seamless passkey authentication across the merchant network.

### 4. On-Chain Soroban RPC Event Verification
Instead of relying solely on off-chain notifications (which are prone to interception or database failures), the SozuPay dashboard now verifies payments by listening to and parsing Soroban RPC transaction events. This provides cryptographic certainty that a checkout session has been settled on-chain before marking it as complete.

---

## sozupay 0.3 (SozuPay Dashboard)

**Repository:** [sozupay_mvp](https://github.com/blessedux/sozupay_mvp)

### Shipped Commits (June 8 — June 14, 2026)

| Date | Commit | Author / Summary |
| :--- | :--- | :--- |
| 2026-06-14 | `655f7c4` | fix(passkey): resolve RP ID mismatch on merchant domains and add recipient Sozu tag payout support |
| 2026-06-14 | `37a8930` | fix: resolve dashboard primary key and verify transaction history for smart accounts and fix checkout completion verification |
| 2026-06-14 | `c6befbe` | feat: implement clickable transaction receipts, ReceiptModal, and POS checkout session ID QR codes |
| 2026-06-14 | `8253339` | fix: configure org treasury smart account address on contract creation & verify checkout payments via Soroban RPC events |
| 2026-06-14 | `c4bf189` | feat: add receipt modal and payment details to cobrar tab |
| 2026-06-14 | `b1c4fd7` | docs: clarify treasury_smart_account_address requirement in configuration |
| 2026-06-14 | `e9341ff` | feat: add logging to checkout creation to verify address selection |
| 2026-06-14 | `5ed7d92` | fix: handle PGRST116 error when organization not found in treasury address API |
| 2026-06-14 | `1807917` | fix: add logging and improve verification for treasury address handling |
| 2026-06-14 | `68964d5` | fix: update balance checking and payment verification to use treasury address |
| 2026-06-14 | `0740871` | fix: add transaction hash and payment method to stub checkout webhook |
| 2026-06-14 | `0115fb4` | fix: update webhook to set transaction hash and payment method on completion |
| 2026-06-14 | `0fa5ccd` | fix: prioritize treasury smart account address for checkout payments |
| 2026-06-14 | `70f1738` | feat: add dynamic org treasury address fetching for checkout |
| 2026-06-13 | `24c06bc` | Fix TypeScript no-explicit-any error in verify-stellar-payment |
| 2026-06-13 | `963cbf8` | Add SOZU checkout completion APIs and on-chain verification |
| 2026-06-13 | `ff88107` | Fix checkout links for SozuCredit, list dates, and dynamic QR redirect |
| 2026-06-13 | `f85ec02` | Fix stub ramp checkout redirect and complete deposit webhook on testnet |
| 2026-06-13 | `e122239` | Fix Vercel build: duplicate recipients state and cashout release error typing |
| 2026-06-13 | `a99332e` | Add merchant commerce layer: landing, dynamic QR/NFC, checkout, and off-ramp POC |

### Key Features & Code Changes

* **Merchant Commerce Layer POC (`a99332e`, `f85ec02`, `ff88107`):**
  * Built a sleek merchant landing page, dynamic QR code/NFC payment routes, checkout page integrations, and an off-ramp Proof-of-Concept.
  * Corrected checkout redirects and stub ramp flow completion hooks for Testnet.
* **On-Chain Soroban Verification & Security (`963cbf8`, `8253339`, `68964d5`):**
  * Added checkout verification APIs that directly query Soroban RPC events to guarantee funds arrived at the merchant's smart account.
  * Persisted the merchant's `treasury_smart_account_address` upon contract creation and configured all APIs to fetch this address dynamically.
* **Enhanced POS Experience (`c6befbe`, `c4bf189`):**
  * Integrated a detailed `ReceiptModal` displaying transaction hash, payment method, date, and status.
  * Allowed users to click on any transaction row under the ledger or **Cobrar** tab to pull up the digital receipt.
* **Passkey Domain Matching (`655f7c4`):**
  * Solved WebAuthn credential failures by dynamically resolving RP IDs for custom domains during merchant checkouts. Added Sozu tag lookup capabilities.

---

## sozu wallet 0.3 (Sozu Wallet)

**Repository:** [SozuCredit](https://github.com/blessedux/SozuCredit)

### Shipped Commits (June 8 — June 14, 2026)

| Date | Commit | Author / Summary |
| :--- | :--- | :--- |
| 2026-06-14 | `fd424d6` | fix: restore checkout complete API notification and fix symbol comparison bug in WebAuthn signing |
| 2026-06-14 | `609eeb6` | feat: enhance QR scanner to parse checkout session IDs and pay/qr short-links |
| 2026-06-14 | `c70df99` | fix(wallet): enhance QR scanner to accept checkout session IDs and slugs, redirecting to correct checkout page |
| 2026-06-14 | `1c22bfe` | Add support for checkout QR codes from sozupay dashboard QR POS |
| 2026-06-14 | `732e481` | Implement dynamic org treasury address fetching |
| 2026-06-14 | `1fe2106` | Fix black screen on checkout page by removing useWalletDataContext |
| 2026-06-14 | `b2844d4` | Refresh transaction history after successful payment |
| 2026-06-14 | `7509fbf` | Skip checkout complete API call and rely on on-chain payment success |
| 2026-06-14 | `eda66f0` | Remove hardcoded treasury address override to support dynamic org addresses |
| 2026-06-13 | `1ab2afc` | Handle checkout complete verification failure gracefully when destination is overridden |
| 2026-06-13 | `8642e20` | Override destination to use org treasury smart account instead of classic G wallet |
| 2026-06-13 | `60b0768` | Add logging to checkout complete proxy to debug 400 error |
| 2026-06-13 | `441ca28` | Fix CORS error for checkout complete API call |
| 2026-06-13 | `38ac71b` | Add comprehensive logging to debug payment destination issue |
| 2026-06-13 | `6f92ee0` | Fix checkout background colors and add payment destination debugging |
| 2026-06-13 | `a575716` | Complete checkout flow with passkey signing and UI improvements |
| 2026-06-13 | `f3f5693` | Fix CORS error for checkout session fetch |
| 2026-06-13 | `973fa04` | Fix PaymentReceipt type to match actual schema |
| 2026-06-13 | `ccbb904` | Simplify checkout payment to use existing wallet API flow |
| 2026-06-13 | `eddf9c7` | Add payer checkout experience for merchant payment links |
| 2026-06-09 | `7ecaa6e` | Fix faucet claim 502 when vault is underfunded and polish claim UX |
| 2026-06-09 | `b2a11bf` | Add Sozu Faucet testnet MVP with NFC claim flow and vault contract |

### Key Features & Code Changes

* **Sozu Faucet Testnet MVP (`b2a11bf`, `7ecaa6e`):**
  * Designed and deployed a testnet faucet powered by a custom Soroban smart vault contract.
  * Added support for NFC-triggered claiming flow, allowing users to claim test tokens simply by scanning an NFC tag.
  * Provided clean error boundaries and UI notifications to handle instances where the vault contract is underfunded (502 recovery logic).
* **Native Payer Checkout Experience (`eddf9c7`, `a575716`, `ccbb904`):**
  * Created a dedicated payer UI that retrieves active checkout session parameters, lists transaction details, and requests authorization.
  * Integrated passkey signing using WebAuthn so that Soroban smart accounts can authorize the payment on-chain via WebAuthn signatures.
  * Corrected WebAuthn symbol/string comparisons (`fd424d6`) to ensure signing succeeds under all browser locales.
* **Smart Account Treasury Routing (`8642e20`, `732e481`):**
  * Overrode the default recipient address on checkout transactions to point directly to the merchant's dynamic smart account instead of a standard wallet, decoupling layout logic from backend routing.
* **Smart QR Scanner (`c70df99`, `609eeb6`):**
  * Upgraded the built-in scanner to capture POS session QR codes and redirect users instantly to the correct pay flow.

---

## Brief Summary

In summary, this week's sprint bridged the gap between merchant point-of-sale functionality and WebAuthn-secured smart wallet payments:
1. **Sozu Wallet 0.3** introduces on-chain WebAuthn/passkey-signed payments, dynamic merchant smart account routing, a custom QR reader for checkout session redirection, and a testnet NFC-enabled token faucet contract.
2. **SozuPay 0.3** enables organizations to dynamically fetch their treasury contract address, verify incoming payments securely using Soroban RPC events, view full digital transaction receipts, and display dynamic checkout session QR codes on the POS interface.
