# Turnkey + Stellar: Step-by-step analysis for abstract wallets and signing with passkeys

This doc analyzes using **Turnkey** to abstract Stellar wallets and sign Stellar transactions with **passkeys** (or email OTP), so users get Gmail/passkey login and sign Stellar tx without managing seed phrases.

---

## 1. High-level flow (as you described)

| Step | What happens |
|------|----------------|
| **1. User auth** | User signs up with `signUpWithPasskey()` or email OTP → Turnkey creates a **sub-organization** with a **Stellar wallet account** (XLM address format, Ed25519). A **session** is established for later operations. |
| **2. Wallet creation** | During signup, sub-org is created with a wallet that has a **Stellar account**: `ADDRESS_FORMAT_XLM`, `CURVE_ED25519`, path `m/44'/148'/0'/0'/0`. |
| **3. Transaction signing** | When the user needs to sign a Stellar tx, the app calls Turnkey’s signing API with the **unsigned transaction** and **stamps with passkey** so the user approves with their passkey. Private keys never leave Turnkey’s TEEs. |

Below we break this down with **actual Turnkey APIs**, **Stellar specifics**, and **integration points** for SozuPay.

---

## 2. User authentication flow (Turnkey)

### 2.1 Options

- **Passkey:** `signUpWithPasskey()` (React: `useTurnkey().signUpWithPasskey()`). User creates a passkey on your domain; Turnkey creates a sub-org with that passkey as root auth.
- **Email OTP:** `signUpWithOtp()` → user receives code → `verifyOtp()`; sub-org is created with email as credential.
- **OAuth (Gmail, etc.):** `signUpWithOauth()` for social login; sub-org created with OIDC.

Session is then used for all subsequent Turnkey calls (stored/stamped with passkey or API key in iframe).

### 2.2 Relevant packages

- **React (Next.js):** `@turnkey/react-wallet-kit` — `TurnkeyProvider` + `useTurnkey()` (signUp*, login*, `httpClient`, `wallets`).
- **Browser (no React):** `@turnkey/sdk-browser` — `Turnkey`, `passkeyClient()`, etc.
- **Server (sub-org creation if custom):** `@turnkey/sdk-server` — create sub-org with parent org API keys.

For **embedded wallets** with minimal backend, use the **Embedded Wallet Kit** and Turnkey’s **Auth Proxy** so signup/login and sub-org creation are handled by Turnkey; you only configure **which wallet accounts** to create (e.g. Stellar).

### 2.3 Fixing Google OAuth `redirect_uri_mismatch` (Error 400)

When using Google sign-in with **Turnkey’s Auth Proxy**, Google may receive a **Turnkey** redirect URI, not your app’s. Add **all** of the following in Google Cloud Console so the exact URI sent by the SDK matches.

**In Google Cloud Console** → **APIs & Services** → **Credentials** → your **OAuth 2.0 Client ID** (Web application):

1. **Authorized redirect URIs** – add **both**:
   - `http://localhost:3000` (no trailing slash)
   - `https://oauth-redirect.turnkey.com` (Turnkey’s default when using Auth Proxy)
   - If you set `NEXT_PUBLIC_TURNKEY_OAUTH_REDIRECT_URI` to a custom URL, add that exact URL here too.

2. **Authorized JavaScript origins** – add **both**:
   - `http://localhost:3000`
   - `https://oauth-redirect.turnkey.com` (or `https://authproxy.turnkey.com` if Turnkey docs specify it)

3. **Save** and wait a minute for changes to propagate, then try sign-in again.

**If you still get redirect_uri_mismatch:** (1) Try **incognito** or clear cache—Google can take a few minutes to apply changes. (2) In DevTools → Network, click Sign in with Google and find the request to accounts.google.com; copy the **exact** `redirect_uri` from the URL (URL-decode it) and add it to Authorized redirect URIs. (3) Remove `NEXT_PUBLIC_TURNKEY_OAUTH_REDIRECT_URI` from `.env.local` so Turnkey uses its default `https://oauth-redirect.turnkey.com`; ensure that is in Google Console. Then try again in incognito.

If it still fails, open the **browser Network tab** when you click “Sign in with Google”, find the request to `accounts.google.com` (or the OAuth redirect), and check the `redirect_uri` query parameter. Add that **exact** value to Authorized redirect URIs.

---

## 3. Wallet creation: Stellar account in sub-org

Turnkey supports **Stellar** at **Tier 2** (address derivation): [Wallets — Address formats and curves](https://docs.turnkey.com/concepts/wallets):

| Type   | Address Format      | Curve         | Default HD Path        |
|--------|--------------------|---------------|-------------------------|
| Stellar | **ADDRESS_FORMAT_XLM** | **CURVE_ED25519** | **m/44'/148'/0'/0'/0** |

So the **wallet account** you create for each user is:

```ts
const stellarAccount = {
  curve: "CURVE_ED25519",
  pathFormat: "PATH_FORMAT_BIP32",
  path: "m/44'/148'/0'/0'/0",
  addressFormat: "ADDRESS_FORMAT_XLM",
};
```

### 3.1 Where to plug this in (React Embedded Wallet Kit)

Sub-org creation is customized via **`createSuborgParams`** in `TurnkeyProvider` config ([Sub-organization customization](https://docs.turnkey.com/sdks/react/sub-organization-customization)):

```tsx
import {
  TurnkeyProvider,
  TurnkeyProviderConfig,
} from "@turnkey/react-wallet-kit";
import "@turnkey/react-wallet-kit/styles.css";

const turnkeyConfig: TurnkeyProviderConfig = {
  auth: {
    createSuborgParams: {
      passkeyAuth: {
        userName: "Passkey User",
        customWallet: {
          walletName: "Stellar Wallet",
          walletAccounts: [
            {
              curve: "CURVE_ED25519",
              pathFormat: "PATH_FORMAT_BIP32",
              path: "m/44'/148'/0'/0'/0",
              addressFormat: "ADDRESS_FORMAT_XLM",
            },
          ],
        },
      },
      emailOtpAuth: {
        userName: "Email User",
        customWallet: {
          walletName: "Stellar Wallet",
          walletAccounts: [
            {
              curve: "CURVE_ED25519",
              pathFormat: "PATH_FORMAT_BIP32",
              path: "m/44'/148'/0'/0'/0",
              addressFormat: "ADDRESS_FORMAT_XLM",
            },
          ],
        },
      },
    },
  },
};

<TurnkeyProvider config={turnkeyConfig}>{children}</TurnkeyProvider>
```

So: **one Stellar account (G...)** per user sub-org, derived inside Turnkey’s infrastructure. No seed phrase on device; key material stays in Turnkey TEEs.

### 3.2 Getting the user’s Stellar address after signup

After login/signup, `useTurnkey().wallets` (and `refreshWallets()`) gives you the list of wallets and accounts. Find the account with `addressFormat: "ADDRESS_FORMAT_XLM"` (or the single account if you only create one). Its `address` is the **Stellar public key (G...)**. You can send this to your backend to store as `stellar_public_key` (or equivalent) for activation, payouts, etc.

---

## 4. Transaction signing: Stellar vs Turnkey APIs

### 4.1 Turnkey’s `signTransaction` does **not** support Stellar

From [Sign transaction](https://docs.turnkey.com/api-reference/activities/sign-transaction), the supported `type` values are:

- `TRANSACTION_TYPE_ETHEREUM`
- `TRANSACTION_TYPE_SOLANA`
- `TRANSACTION_TYPE_TRON`
- `TRANSACTION_TYPE_BITCOIN`
- `TRANSACTION_TYPE_TEMPO`

There is **no** `TRANSACTION_TYPE_STELLAR`. So we **cannot** use `signTransaction()` for Stellar.

### 4.2 Use **Sign Raw Payload** for Stellar (Ed25519)

Stellar uses **Ed25519** to sign a **single hash**: the **transaction hash** (SHA-256 of the envelope-to-sign payload). So the flow is:

1. **App (or backend):** Build the unsigned Stellar transaction (e.g. with `@stellar/stellar-sdk`), get the **transaction envelope** (XDR).
2. **App:** Compute the **payload that Stellar signs** = the **transaction hash** (in Stellar SDK: `transaction.hash()` — 32-byte SHA-256).
3. **App:** Call Turnkey **`signRawPayload`** with:
   - `signWith`: the **wallet account address** (the user’s Stellar G... address).
   - `payload`: the **transaction hash** in **hex** (32 bytes = 64 hex chars).
   - `encoding`: `PAYLOAD_ENCODING_HEXADECIMAL`.
   - `hashFunction`: `HASH_FUNCTION_NO_OP` (payload is already the hash).
4. **Turnkey:** User is prompted to **stamp** the request (e.g. with **passkey**). Private key never leaves Turnkey; they sign the hash in their TEE and return the signature.
5. **App:** Turnkey returns a **signature**. For Ed25519 this may be a single 64-byte signature or (r, s, v)-style fields — **must be verified** in Turnkey’s docs or SDK for Ed25519. Then you must **add this signature** to the Stellar transaction envelope (Stellar uses “decorated” signatures: key hint + signature hint + 64-byte raw).
6. **App:** Submit the **signed envelope** to Horizon (or return to backend for submit).

### 4.3 Stamp with passkey (React)

From [Advanced API requests](https://docs.turnkey.com/sdks/react/advanced-api-requests), you can pass **`StamperType.Passkey`** so the **sign raw payload** request is stamped by the user’s passkey:

```tsx
import { useTurnkey, StamperType } from "@turnkey/react-wallet-kit";

const response = await httpClient.signRawPayload(
  {
    signWith: stellarAccountAddress, // G...
    payload: txHashHex,              // 64 hex chars (32-byte hash)
    encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
    hashFunction: "HASH_FUNCTION_NO_OP",
  },
  StamperType.Passkey
);
```

So: **same passkey** used for login can be used to approve the sign request. UX: “Sign in with passkey” → later “Approve transaction with passkey.”

### 4.4 Open point: Ed25519 signature format from Turnkey

Turnkey’s [Sign raw payload](https://docs.turnkey.com/api-reference/activities/sign-raw-payload) result is documented as **r, s, v** (ECDSA-style). For **Ed25519** (Stellar), the actual return format may differ (e.g. a single 64-byte signature or different field names). Before implementation:

- Check Turnkey’s API or SDK for **Ed25519 / CURVE_ED25519** `signRawPayload` result shape.
- Map that to Stellar’s **DecoratedSignature** (4-byte key hint, 4-byte sig hint, 64-byte raw Ed25519 signature) and use Stellar SDK’s `transaction.addSignature(...)` or equivalent to produce the signed envelope for Horizon.

---

## 5. End-to-end flow (step-by-step)

| # | Step | Who / Where | Action |
|---|------|--------------|--------|
| 1 | Auth | Client | User clicks “Sign up with passkey” (or email OTP). `signUpWithPasskey()` (or OTP flow). Turnkey creates sub-org with **one Stellar wallet account** (XLM, Ed25519, path above). Session created. |
| 2 | Address | Client | `useTurnkey().wallets` → find account with `addressFormat: "ADDRESS_FORMAT_XLM"` → get `address` (G...). Optionally send to backend to store as user’s Stellar address. |
| 3 | Build tx | Client or Server | Build unsigned Stellar tx with `@stellar/stellar-sdk` (e.g. ChangeTrust, Payment). Get envelope and compute **tx hash** (`transaction.hash()`). |
| 4 | Sign | Client | `httpClient.signRawPayload({ signWith: G..., payload: txHashHex, encoding: HEX, hashFunction: NO_OP }, StamperType.Passkey)`. User approves with passkey. |
| 5 | Attach sig | Client | Map Turnkey’s signature to Stellar’s DecoratedSignature; add to transaction; get signed envelope XDR. |
| 6 | Submit | Client or Server | Submit signed envelope to Horizon (or your backend that submits to Horizon). |

---

## 6. Key components (summary)

| Component | Role |
|-----------|------|
| **Auth** | Passkey or email OTP creates sub-org and session; no seed phrase. |
| **Wallet** | Stellar-compatible Ed25519 key in Turnkey; address = G... from `ADDRESS_FORMAT_XLM` + path `m/44'/148'/0'/0'/0`. |
| **Signing** | `signRawPayload` with tx hash (hex, NO_OP hash); user approves with **passkey** via `StamperType.Passkey`. |
| **Security** | Private keys never leave Turnkey TEEs; passkey only attests/stamps the sign request. |

---

## 7. SozuPay integration considerations

- **Current design:** Privy for auth; user creates Stellar keypair **client-side** and registers **public key**; we never see the secret. Activation/funding via our backend (see [wallet-activation-funding-roadmap.md](../03-planning/wallet-activation-funding-roadmap.md)).
- **With Turnkey:** Auth could be **Turnkey passkey/OTP** instead of (or in addition to) Privy. Wallet is **Turnkey-derived** Stellar account; **no client-side keypair** and no seed phrase. We’d store the **Turnkey-derived G...** as the user’s Stellar address and keep activation/funding logic (e.g. mainnet auto-fund for pre-invited users).
- **Signing today:** We return **unsigned** XDR (e.g. trustline) and user signs in browser with their secret. **With Turnkey:** We’d return unsigned XDR (or tx hash); client calls `signRawPayload` with passkey stamp, then attaches signature and submits (or sends signed XDR to backend to submit).
- **Smart accounts (C):** Turnkey gives a **classic G** address. If we move to smart accounts (C), the **signer** for the smart account could still be the Turnkey G (key stored in Turnkey); smart-account creation and USDC setup would remain as in [smart-accounts.md](../01-architecture/smart-accounts.md).

---

## 8. Testing the Stellar transaction flow (Ed25519)

Stellar expects **Ed25519** signatures: 64-byte raw signature (R||S per RFC 8032). The flow in this repo:

1. **Build / fetch unsigned XDR** – e.g. Dashboard → Profile → “Add USDC trustline” calls `/api/profile/wallet/trustline-tx` to get an unsigned envelope.
2. **Sign with Turnkey** – `signStellarTransactionWithTurnkey()` in `src/lib/stellar/turnkey-sign.ts`:
   - Builds `Transaction` from envelope, gets **tx hash** (`tx.hash()` = SHA-256), sends **hash as hex** to Turnkey `signRawPayload` with `HASH_FUNCTION_NO_OP`.
   - Turnkey returns a signature (either `{ signature }` hex or `{ r, s }` hex); we normalize to **64-byte** buffer (R||S).
   - `tx.addSignature(signWithAddress, rawSigBase64)` – the SDK derives the 4-byte **hint** from the signer’s public key (G...).
3. **Submit** – Signed envelope XDR is POSTed to Horizon.

To test end-to-end: use Turnkey login, go to Dashboard → Profile, ensure the account has a Stellar (G...) address, then use “Add USDC trustline” and complete the passkey signing step. The signed transaction must be valid Ed25519 for Horizon to accept it.

---

## 9. References

- [Turnkey — Wallets (address formats)](https://docs.turnkey.com/concepts/wallets): ADDRESS_FORMAT_XLM, CURVE_ED25519, path.
- [Turnkey — Sub-organization customization (React)](https://docs.turnkey.com/sdks/react/sub-organization-customization): `createSuborgParams`, `customWallet`, `walletAccounts`.
- [Turnkey — Sign transaction](https://docs.turnkey.com/api-reference/activities/sign-transaction): supported types (no Stellar).
- [Turnkey — Sign raw payload](https://docs.turnkey.com/api-reference/activities/sign-raw-payload): payload, encoding, hashFunction.
- [Turnkey — Advanced API requests (React)](https://docs.turnkey.com/sdks/react/advanced-api-requests): `httpClient.signRawPayload(..., StamperType.Passkey)`.
- [Turnkey — Networks overview](https://docs.turnkey.com/networks/overview): Tier 2 = address derivation (Stellar supported).
- Stellar: transaction hash = SHA-256 of envelope-to-sign; signing = Ed25519 of that hash; [js-stellar-sdk](https://stellar.github.io/js-stellar-sdk/Transaction.html) `transaction.hash()`, `addSignature`, decorated signatures.
