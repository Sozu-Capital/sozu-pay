# Sozu Ecosystem — Development Roadmap

This document organizes **development cycles and phases** for Sozu dapps and infrastructure. It is the single reference for sequencing: what we build, in what order, and why.

**Stack:** Stellar · Blend · MoneyGram  
**Principle:** No scope creep. Each phase leads to the next layer.

---

## Strategic Architecture Logic

| Phase | Focus | Outcome |
|-------|--------|---------|
| **Year 1** | Build trust + data + wallet distribution | NGO Financial OS (Foundation) |
| **Year 2** | Monetize flow (merchant settlement + credit) | Merchant Acceptance + Anchor Path |
| **Year 4** | Own the rail (anchor + hardware) | Full Payment Rail + Proprietary NFC Cards |

Each phase builds on:
- Real transaction volume
- Behavioral data
- Regulatory progression
- Liquidity depth

---

## High-Level Phasing

### Year 1 — NGO Disbursement Financial OS (Foundation)

**Objective:** Launch a working NGO microcredit disbursement + tracking system in Argentina using USDC on Stellar.

- **Months 0–3:** Core infrastructure (Sozu Wallet, USDC on Stellar, Soroban contracts, Defindex/Blend yield)
- **Months 2–6:** NGO Admin Dashboard (SozuPay Phase 1 — bulk beneficiaries, disbursement schedules, repayment tracking, transparency)
- **Months 4–8:** Behavioral Credit Layer (Trust Score, borrowing caps, pilot micro-loans via Blend)
- **Months 6–12:** Onboarding (first Argentine NGO, 500–2k recipients, MoneyGram offramp live)

**Key milestone at 12 months:** Fully operational NGO disbursement OS; recipients using Sozu wallet; repayment tracking; yield auto-compounding; first behavioral credit cycle.

#### Shadow payment rail POC (manual bridge spike)

This is **not** production fiat licensing or a live PSP integration. It is a **closed-loop simulation** of Year 2 merchant settlement: internal ledger, manual “confirm payment” oracle, API-first payment creation, CLP→USDC quoting with a fixed spread—so we validate UX and ops **before** a Fiat Bridge Aggregator.

- **In scope:** Ledger tables, merchant payment API, admin confirmation flow, optional manual CLP withdrawal queue.
- **Explicitly out of scope for this spike:** Anchor licensing, card issuance, automated webhooks/PSP, production chargeback handling.

**Spec and schema:** [03-planning/shadow-payment-rail-poc.md](./03-planning/shadow-payment-rail-poc.md) · **SQL:** [supabase-shadow-ledger.sql](./supabase-shadow-ledger.sql)

**Priority:** High for the **SozuPay_dashboard** product track (parallel or short-lag with NGO dashboard work); it does **not** replace NGO-first distribution in the ecosystem.

---

### Year 2 — Merchant Acceptance + Anchor Path

**Objective:** Customer → fiat payment → merchant receives USDC in Sozu wallet.

- **Months 12–18:** Sozu Business Wallet, revenue analytics, auto yield, revenue-based credit
- **Months 12–18:** Fiat Bridge Aggregator (Model B — PSP collects fiat, converts to USDC, settles to merchant; Sozu as routing layer; T+1/T+2)
- **Months 18–24:** Anchor preparation (compliance, KYC, fiat liquidity relationships)

**Key milestone:** Active merchant USDC settlement; revenue-based merchant credit; Anchor licensing pathway initiated.

---

### Year 4 — Full Payment Rail + Proprietary NFC Cards

**Objective:** Reduce reliance on external card networks; expand distribution.

- Sozu Merchant Network (QR + NFC, stablecoin-native settlement)
- Halo Burner Smart Contract Cards (NFC, session-based spending, programmable debit)
- Anchor status (direct fiat on/off ramp, local ARS liquidity)
- Full Financial OS distribution

**Key milestone:** Parallel USDC-native financial infrastructure (NGO microcredit + behavioral credit + merchant settlement + anchor rails + NFC cards).

---

## Development Cycle Conventions

Use this section to align sprints and releases with the roadmap.

### Cycle Types

| Type | Duration | Use for |
|------|----------|--------|
| **Infrastructure cycle** | 2–3 months | Wallet, contracts, integrations (Blend, Defindex, Stellar) |
| **Product cycle** | 1–2 months | Dashboard features, batch flows, reporting |
| **Pilot cycle** | 3–6 months | NGO onboarding, behavioral credit pilot, offramp go-live |

### Phase Gates

Before moving to the next **year-phase**:

1. **Volume & data:** Target transaction volume and behavioral data thresholds met.
2. **Regulatory:** No blocking regulatory risk for the next phase (e.g. no anchor licensing in Year 1).
3. **Liquidity & ops:** Liquidity and operational runbooks in place for the current phase.

### Document Links

| Focus | Document |
|-------|----------|
| **NGO disbursement + Sozu wallet + DeFi + offramp** | [ngo-disbursement-wallet-dev-plan.md](./ngo-disbursement-wallet-dev-plan.md) |
| **Production dashboard & simultaneous disbursements** | [production-disbursements-tasks.md](./production-disbursements-tasks.md) |
| **Technical spec** | [technical-spec.md](./technical-spec.md) |
| **NFRs** | [nfr.md](./nfr.md) |
| **Shadow payment rail POC (ledger + manual oracle)** | [03-planning/shadow-payment-rail-poc.md](./03-planning/shadow-payment-rail-poc.md) |

---

## Critical Execution Principles

**Do NOT:**

- Attempt anchor licensing in Year 1
- Attempt card issuance in Year 1
- Attempt **production** fiat bridge (licensed PSP, automated settlement) before real volume

**Sequence matters.** Distribution comes from NGOs first. A **manual** shadow-rail POC (internal ledger + ops confirmation) is allowed to de-risk merchant UX without counting as “fiat bridge” in the sense above—see *Shadow payment rail POC* under Year 1.

---

## Ecosystem Roles (Reference)

| Actor | Role |
|-------|------|
| **NGOs** | Distribution channel, trust validator, volume generator |
| **Merchants** | Yield recipients, credit clients, revenue nodes |
| **Wallet users** | Behavioral collateral creators |

Everything feeds the credit engine.

---

## Document History

| Version | Date | Change |
|--------|------|--------|
| 0.1 | 2026-03-01 | Initial: phased roadmap (Y1, Y2, Y4) and dev cycle conventions. |
| 0.2 | 2026-04-04 | Shadow payment rail POC: spike placement, doc links, clarify manual POC vs production fiat bridge. |
