# SEP-30 Integration — Development Plan (Later Stage)

**Status:** Planning · **Phase:** Post–30-day sprint  
**Goal:** Users don’t need to remember a password and always have access to their panel and treasury.

This document plans a **SEP-30** (Recovery Signer) integration for a future development stage. The current **30-day sprint** focuses on foundation (landing, SDP provider, dashboard persistence + single payout). SEP-30 work is explicitly **out of scope** for that sprint and is planned here for a later cycle.

**Reference:** [SEP-30 and user-friendly key management (Stellar)](https://stellar.org/blog/developers/sep-30-recoverysigner-user-friendly-key-management)

---

## 1. Why SEP-30 for SozuPay

### 1.1 Our goals

| Goal | Meaning |
|------|--------|
| **No password to remember** | Login and recovery via phone number or email (SMS/link), not a secret phrase or password. |
| **Always access to panel** | Staff (equipo interno) can always reach the dashboard and org space, even after losing a device. |
| **Always access to treasury** | Org wallet / disbursement authority can be recovered; no single-device key that, if lost, locks the org out. |

SEP-30 is a Stellar Ecosystem Proposal that defines an API for **key management and recovery** without recovery phrases and without giving a third party full control of the account. It fits our goals because:

1. **Works without recovery phrases** — Users authenticate with identity (e.g. phone, email), not a 12/24-word backup.
2. **No third party in control** — Recovery servers only co-sign under constraints; they cannot move funds alone.
3. **No password to remember** — Identity-based auth (SMS code, email link/code) drives both login and recovery.

### 1.2 How SEP-30 works (short)

- **Two API endpoints:** (1) register an account with a recovery server, (2) request a signature for a transaction (recovery flow).
- **Two independent recovery servers** — Operated by separate entities; each adds a signature. Only together do they meet the account’s signature threshold, so neither has sole control.
- **Identities** — At registration, the wallet tells each server which identities (e.g. phone, email) are allowed to request signatures for that account.
- **Device keys, not a single master key** — The wallet generates a device key for signing; the “master” key is used once during setup then removed. Loss of a device is handled by recovery (new device key added with the help of both recovery servers), not by restoring a phrase.

SozuPay would act as a **SEP-30 client** (wallet/dashboard) that:

- Registers org-related Stellar accounts with two SEP-30 recovery servers.
- Uses identity (phone/email) for recovery so staff never rely on a password or phrase to regain access to the panel or treasury.

---

## 2. Scope and positioning

### 2.1 In scope (this plan)

- **Later-stage** design and implementation of SEP-30 integration for:
  - **Panel access:** Staff can (re)gain access to the dashboard via phone/email, without a password or recovery phrase.
  - **Treasury access:** Org wallet / disbursement authority can be recovered via the same identity-based flow (new device key added with recovery server signatures).
- Planning of:
  - Client flows (registration, recovery) and how they plug into the existing dashboard and org wallet.
  - Requirements for **two independent recovery servers** (self-host vs. ecosystem partners).
  - SEP-10 (auth) and SEP-30 API usage.

### 2.2 Out of scope for the 30-day sprint

- Any SEP-30 implementation work. The sprint stays on: landing, SDP provider registration, dashboard persistence, and single on-chain payout (see [30day-sprint-plan.md](30day-sprint-plan.md)).

### 2.3 Relation to existing docs

| Doc | Relation |
|-----|----------|
| [self-custodial-auth-design.md](../01-architecture/self-custodial-auth-design.md) | SEP-30 preserves “we don’t hold user keys”; we add recovery servers as co-signers and identity-based recovery. |
| [org-wallet-design.md](../01-architecture/org-wallet-design.md) | SEP-30 can apply to org wallet (treasury) so that recovery is possible without a single secret in one place. |
| [roadmap.md](../00-overview/roadmap.md) | SEP-30 fits in Year 1 (improved onboarding/UX) or early Year 2; exact placement TBD by capacity. |
| [30day-sprint-plan.md](30day-sprint-plan.md) | Foundation delivered in the sprint (auth, persistence, single payout) is prerequisite for later SEP-30 work. |

---

## 3. SEP-30 flows (reference)

### 3.1 Registration (simplified)

1. Wallet creates Stellar account; generates **master key** (used only during setup).
2. Wallet generates **device key**; submits tx: add device key as signer, remove master key; then deletes master key.
3. Wallet registers with **two** recovery servers (separate entities). For each:
   - Proves control of the account (e.g. SEP-10 challenge-response).
   - Tells server: “identities allowed to request signatures” (e.g. phone, email).
   - Receives server’s signing address; adds it as signer with limited weight so neither server alone can authorize.
4. Result: only the device key (and the two recovery servers together) can authorize; user recovers via identity at the two servers.

### 3.2 Recovery (e.g. lost device)

1. New device: wallet generates new device key; user authenticates with **identity** (phone/email) at the wallet.
2. Wallet requests first recovery server to sign a tx that adds the new device key and removes the old one; server checks identity and signs (e.g. weight 10).
3. Wallet requests second recovery server; user authenticates with that **independent** party (SMS or email); server signs same tx (e.g. weight 10).
4. Combined weight meets threshold; wallet submits tx. New device key is now a signer; old one removed. User has access again without a password or phrase.

---

## 4. Development plan (later stage)

### 4.1 Prerequisites (from current sprint and foundation)

- **Auth and users:** Privy (or equivalent) and user/org model stable; we know who “staff” is and which org they belong to.
- **Dashboard and org wallet:** Persistence and single payout in place; org wallet (G or Soroban) is the treasury we want to make recoverable.
- **Stellar integration:** Horizon (and optionally Soroban) used for balances and transactions; keypairs and signing patterns understood.

These are exactly what the **30-day sprint** and immediate follow-up deliver. No SEP-30 implementation should block or be blocked by the sprint.

### 4.2 Suggested phases (post–sprint)

| Phase | Focus | Outcome |
|-------|--------|---------|
| **Discovery** | SEP-30 spec, SEP-10, and existing implementations (e.g. Vesseo); decide recovery server strategy (self-host vs. partners). | Clear API contract, list of two recovery server options, and alignment with Stellar. |
| **Design** | Map SEP-30 registration and recovery to our flows: (1) staff panel access, (2) org treasury (device key + recovery servers as signers). | Design doc: flows, DB/backend changes, and UX for “recover access” in dashboard. |
| **Recovery server(s)** | Stand up or partner for **two** independent SEP-30 recovery servers; implement register + sign endpoints; identity verification (SMS/email). | Two live recovery servers usable from our client. |
| **Client: registration** | After wallet/org setup, register Stellar account with both recovery servers; set identities (phone/email); add server signers to account. | New (or migrated) org/staff accounts are SEP-30 protected. |
| **Client: recovery** | “Recover access” flow in dashboard: new device key, collect signatures from both servers via identity auth; submit tx. | Staff can regain panel and treasury access with phone/email only. |
| **Hardening** | Security review, rate limits, audit logging, runbooks. | Production-ready SEP-30 integration. |

Timing and resourcing to be set when the 30-day sprint is complete and roadmap is updated.

### 4.3 Dependencies and risks

| Dependency / risk | Mitigation |
|-------------------|------------|
| **Two independent recovery servers** | Decide early: self-host two separate services vs. one self-host + one partner (e.g. Stellar ecosystem). SEP-30 requires two independent parties. |
| **Identity verification** | SMS/email delivery and verification (cost, deliverability). Consider existing auth (e.g. Privy) vs. dedicated recovery identity. |
| **SEP-10 + SEP-30** | Implement SEP-10 challenge-response where required for recovery server auth; document and test. |
| **Org wallet migration** | Existing orgs may have a single key in env; migrating to device key + 2 recovery signers needs a one-time migration and careful key rotation. |

---

## 5. Success criteria (when we implement)

- Staff can log in or recover access using **phone number or email** (no password or recovery phrase).
- Staff **always** can regain access to the **dashboard** (panel) after device loss, using the same identity.
- **Treasury** (org wallet) can be recovered the same way: new device key added via two recovery server signatures, identity-based.
- No single third party can move org or user funds; recovery is multi-party and constrained by SEP-30 design.

---

## 6. Document links

| Topic | Document |
|-------|----------|
| SEP-30 (Stellar blog) | [SEP-30 and user-friendly key management](https://stellar.org/blog/developers/sep-30-recoverysigner-user-friendly-key-management) |
| 30-day sprint (foundation) | [30day-sprint-plan.md](30day-sprint-plan.md) |
| Roadmap and phasing | [roadmap.md](../00-overview/roadmap.md) |
| Self-custodial auth | [self-custodial-auth-design.md](../01-architecture/self-custodial-auth-design.md) |
| Org wallet and signing | [org-wallet-design.md](../01-architecture/org-wallet-design.md) |

---

## Document history

| Version | Date | Change |
|--------|------|--------|
| 0.1 | 2026-03-06 | Initial: SEP-30 integration plan for later stage; goals (no password, always access to panel and treasury); phases, prerequisites, dependencies. |
