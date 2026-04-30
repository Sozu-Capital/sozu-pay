# SDP-ready non-custodial wallet (passkey-gated client signing)

This document specifies a wallet architecture that:

- avoids secret-key copy/paste UX (no `S…` shown to recipients),
- enables **SEP-10 signing** required by the Stellar Disbursement Platform (SDP),
- remains **non-custodial** in the strong sense: Sozu servers cannot sign on the user’s behalf.

It is designed for a **Sozu PWA** recipient wallet where users authenticate with Google/passkeys/magic links, but *do not* need a third-party wallet app/extension (Freighter, etc.).

---

## Goals and non-goals

### Goals

- **SEP-10 compatible**: produce valid Stellar signatures for SDP challenges.
- **No secret exposure**: users never see or paste a Stellar secret key.
- **Server non-custody**: the server may store encrypted material, but must not be able to decrypt or sign.
- **Web2-grade UX**: passkey/biometric prompts for approvals; clear “sign to continue” steps.

### Non-goals (for now)

- Full recovery implementation (see `docs/03-planning/wallet-recovery-plan.md`).
- Multi-device synchronization guarantees.
- SEP-24 withdraw flow (only implement if a target SDP partner requires it).

---

## Key idea (one sentence)

Generate the Stellar keypair **client-side**, encrypt the secret key into a **ciphertext** that is only decryptable after a **WebAuthn (passkey) user-presence assertion**, store the ciphertext (server or local), and always **sign SEP-10 challenges locally**.

---

## Threat model (what “non-custodial” means here)

We consider the wallet **non-custodial** if all are true:

- The Stellar secret key is generated on the client and **never sent/stored in plaintext** outside the client runtime.
- The server stores at most:
  - the user’s Stellar **public key** (`G…`)
  - an **encrypted** Stellar secret key blob (ciphertext)
  - metadata needed for login / routing / allowlist
- Compromise of Sozu servers and databases **does not enable signing** transactions or SEP-10 challenges without the user’s passkey assertion on a user device.

This is compatible with storing encrypted key material server-side as long as:

- the server cannot decrypt (no decryption keys, no bypass path),
- signing cannot be performed server-side.

---

## Components

### Client (PWA)

- **Stellar key generation**: `Keypair.random()` (Stellar SDK)
- **Local signing**: SEP-10 challenge transaction signed in-browser
- **WebAuthn**: passkey prompt used to unlock decryption/signing
- **Key encryption**: encrypt Stellar secret key into a ciphertext blob

### Server (Sozu)

- Stores:
  - `stellar_public_key`
  - `encrypted_stellar_secret_blob` (ciphertext + params, never plaintext)
- Provides:
  - APIs to save/retrieve ciphertext blob
  - existing SDP routes (invite, SEP-10 proxy, SEP-24 deposit interactive)

### SDP / SEP services

- SDP issues SEP-10 challenges and SEP-24 interactive registration URLs.
- Sozu acts as the wallet client domain and proxy, per existing implementation.

---

## Data model (minimal)

Store per-user:

- `stellar_public_key` (string, `G…`)
- `encrypted_stellar_secret_blob` (json/binary encoded string)
- `encrypted_stellar_secret_version` (int) for future migrations
- `wallet_created_at`, `wallet_rotated_at` (timestamps)

The encrypted blob should include:

- `ciphertext`
- `iv` / `nonce`
- `salt` (if used)
- `kdf` / `alg` identifiers
- any WebAuthn credential binding metadata required by the client implementation

---

## Flow 1 — Wallet creation (recipient)

1. **User authenticates** (Google / email magic link / passkey) to create a session.
2. Client generates a Stellar keypair locally.
3. Client encrypts the Stellar secret into an `encrypted_stellar_secret_blob` such that:
   - the secret cannot be decrypted without a WebAuthn assertion (passkey prompt),
   - the server cannot decrypt even if it has the blob.
4. Client sends to server:
   - `stellar_public_key`
   - `encrypted_stellar_secret_blob`
5. Server stores public key + encrypted blob.

Notes:

- If you need proof-of-ownership at registration time, you can require the user to sign a short registration message locally. This is optional if you trust the client generation and you’re already binding the wallet to the authenticated user session.

---

## Flow 2 — SEP-10 signing for SDP (recipient registration)

This matches the existing SDP flow (invite → login → register), but replaces “paste secret key” with local decryption/signing.

1. User opens SDP invite link → `/sdp/invite` verifies and sets invite cookie.
2. User logs in to Sozu.
3. On `/sdp/register`, client requests SEP-10 challenge from Sozu’s SEP-10 challenge route.
4. Client:
   - fetches the user’s `encrypted_stellar_secret_blob`,
   - prompts the user for **passkey/biometric**,
   - decrypts the Stellar secret locally,
   - signs the SEP-10 challenge transaction locally,
   - submits signed transaction to Sozu’s SEP-10 token route (or directly to SDP, depending on implementation).
5. Sozu exchanges for SEP-10 token and proceeds to SEP-24 deposit interactive registration, as currently implemented.

---

## What must be true for the “passkey unlock” step

WebAuthn (passkeys) do not let you “read” the passkey private key. Instead, the architecture must ensure that:

- either the Stellar secret is encrypted with a key that can only be unwrapped/used after a WebAuthn assertion, and/or
- the signing operation itself is gated behind a device-bound cryptographic primitive that requires user presence.

Implementation details can vary, but the invariant is:

> Without a WebAuthn assertion from the user on a device, the encrypted blob is useless.

---

## Operational notes for SDP allowlisting

This architecture does not change the operator requirements in:

- `docs/04-integrations/sdp-wallet-operator-checklist.md`
- `docs/04-integrations/sdp-local-e2e.md`

It only changes *how the user signs* during SEP-10:

- old: user pasted `S…` secret key in browser
- new: user approves a passkey prompt; signing is local; no secret exposure

---

## UX requirements (what the user sees)

- **Create wallet**: “Create your Sozu wallet” → passkey prompt → success → show only the public address (`G…`).
- **Register with SDP**: “Verify your wallet to receive funds” → passkey prompt → success → SDP registration completes.
- **Sending funds** (later): “Approve transaction” → passkey prompt → broadcast.

No step should show a private key, recovery phrase, or `S…` secret.

---

## Open questions / decisions to document when implementing

- Where should the encrypted blob live:
  - server-only, local-only, or hybrid (server + local cache)?
- Multi-device story:
  - should passkeys sync across devices (platform-managed) or do we require explicit export/import?
- “Wallet rotation”:
  - do we support rotating to a new Stellar account if a device is lost?
- Compliance posture:
  - confirm internal language: “non-custodial” vs “self-custodial” vs “user-controlled keys”.

