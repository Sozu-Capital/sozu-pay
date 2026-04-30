# Wallet recovery plan (recipient Sozu wallet)

This document captures the recovery strategy for the recipient wallet when we use **passkey-gated, client-side signing** (see `docs/04-integrations/sdp-passkey-noncustodial-wallet.md`).

It is intentionally written as a plan so we can implement it later without re-litigating requirements.

---

## Problem statement

If the recipient wallet is truly non-custodial (Sozu cannot sign), then **loss of access** can mean **loss of funds** unless we provide a recovery mechanism.

Recipients will commonly face:

- phone loss/theft
- device upgrade
- OS reinstall / browser data cleared
- passkey removed or not syncing
- SIM change (if magic link / SMS is used for login)

We need a recovery approach that keeps a strong non-custodial posture while still offering Web2-grade support.

---

## Recovery goals

- **G1 — Preserve non-custody**: recovery must not give Sozu unilateral signing power.
- **G2 — Minimal user burden**: avoid “write down a seed phrase” as the primary UX.
- **G3 — Works for NGOs**: recovery should be explainable and supportable by field staff.
- **G4 — Secure by default**: recovery should resist account takeover and social engineering.

---

## Terminology

- **Wallet key**: Stellar secret key controlling the recipient account.
- **Encrypted key blob**: ciphertext stored by Sozu (or locally) that can only be decrypted after passkey user-presence.
- **Recovery method**: a process to regain signing capability after device loss.

---

## Recovery options (menu)

We will likely need **at least one primary** method and **one fallback** method.

### Option A — Passkey sync as the primary recovery path

If the passkey is created as a platform passkey that syncs across the user’s devices (iCloud Keychain / Google Password Manager), then:

- user buys a new device
- signs in to their Apple/Google account
- passkey is restored
- wallet access is restored (assuming the encrypted key blob is retrievable)

**Pros**

- Best UX (looks like “just sign in”).
- No manual backup phrase.

**Cons / risks**

- Users may not have platform accounts or may not restore them.
- Platform account recovery becomes a security boundary.

**Implementation notes**

- Make the passkey UX explicit: “Choose to save passkey to your Google/Apple account to enable recovery.”
- Detect whether a passkey is synced vs device-bound where possible (or at least message the risk).

---

### Option B — Encrypted backup escrow (server-stored ciphertext) + passkey rebind

Store the encrypted key blob on the server and allow a “rebind” operation where a *new* passkey can be used to decrypt/re-encrypt, but only after a strong recovery proof.

**Pros**

- Works even if local storage is wiped.

**Cons**

- The “rebind” proof becomes an account takeover target.
- Must be carefully rate-limited and monitored.

**Implementation notes**

- Require multi-factor recovery proofs (e.g., existing session + email link + NGO-assisted verification).
- Add mandatory cooling-off periods for high-risk changes.

---

### Option C — Social / NGO-assisted recovery (guardian model)

For NGO programs, the NGO can act as an assisted recovery party. Examples:

- recipient re-verifies identity in person
- NGO triggers a controlled “wallet rotation” to a new Stellar account
- remaining funds are disbursed to the new address

**Pros**

- Realistic for beneficiary programs (field staff can help).

**Cons**

- Requires operational process and audit logs.
- Not purely self-service.

**Implementation notes**

- Treat as a “rotate wallet” path (see below), not as “decrypt old key”.
- Capture evidence: who approved, when, and what checks were performed.

---

### Option D — SEP-30 recovery (future)

SEP-30 defines a recovery server mechanism for Stellar accounts.

**Pros**

- Standards-aligned.

**Cons**

- More integration work; depends on ecosystem and partner needs.

**Implementation notes**

- Keep this as a later phase if a partner or scale requires it.
- See `docs/03-planning/sep-30-integration-plan.md`.

---

## Recommended staged approach

### Phase 1 (pilot-ready)

- Use **Option A** as the primary: passkey sync.
- Store the encrypted key blob server-side (ciphertext only).
- Implement a clear “What if I lose my phone?” help article in-app.

### Phase 2 (program-scale)

- Add **Option C** (NGO-assisted wallet rotation) with audit logs.

### Phase 3 (ecosystem-grade)

- Add **Option D** (SEP-30) if needed.

---

## Wallet rotation (the pragmatic fallback)

When true recovery of the same Stellar account is not possible, the safest fallback is to:

1. Create a new wallet (new Stellar keypair) under the user’s control.
2. Update the user profile to point to the new public key.
3. If the old wallet is still accessible, transfer remaining funds to the new wallet.
4. If the old wallet is not accessible, document that funds may be unrecoverable (non-custodial reality).

For NGO programs, rotation may be paired with NGO-assisted identity checks.

---

## Security controls (must-have)

- Rate-limit recovery attempts and rebind operations.
- Step-up verification for any action that changes wallet control.
- Cooling-off periods for sensitive changes (e.g., 24–72 hours) unless NGO-assisted.
- Audit logs: actor, method, timestamps, device/session info, and outcome.
- User notifications: email/SMS/push on recovery events.

---

## Open decisions

- Do we allow “rebind to new passkey” (Option B) at all, or only rotation?
- What is the NGO’s operational role in assisted recovery (Option C)?
- What recovery support is acceptable for Mujeres 2000’s recipients (in-person vs remote)?

