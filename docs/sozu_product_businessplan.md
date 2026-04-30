**Sozu Capital – Products Business Plan**  
**Version 1.0 | April 2026**  
**Focus: Phase 1 (NGO Dashboard + Stellar Disbursement) → Phase 2 (BNPL for Beneficiaries with Multi-Lender Flow + Merchant-as-Lender)**

### 1. Eagle’s Eye View – The Entire Business Plan of Sozu Capital

**Vision**  
Sozu Capital is the **neutral financial operating system** for the social-impact economy in Chile and LatAm. We start by solving the biggest pain point for NGOs (high-cost, slow, opaque cash disbursements) using Stellar’s open-source Disbursement Platform + Soroban smart contracts. Once NGOs and their beneficiaries are on the platform, we layer on a **multi-lender BNPL product** that turns beneficiaries into active consumers and merchants into capital providers — creating a closed-loop, yield-generating ecosystem with zero-to-minimal transaction fees.

**Core Thesis**

1. NGOs are the perfect beachhead: they have thousands of verified beneficiaries and recurring disbursement needs.
2. Stellar gives us **batch payments at ~0 fees**, **instant settlement**, **on-demand wallets**, and **Soroban-powered yield** on idle funds.
3. The same infrastructure powers **transparent, multi-lender BNPL** at the point of sale for beneficiaries → higher financial inclusion + new revenue.
4. Merchants become lenders → network effects and capital efficiency.

**Target Market (Chile first, then Peru/Central America)**

- 500+ NGOs handling government aid, remittances, and social programs (UNDP, local foundations, etc.).
- 2M+ low-income beneficiaries without credit cards.
- 50k+ SMEs/merchants in electronics, furniture, health, and fashion who want to offer installments.

**Phased Monetization & Scalability**

- **Phase 1 (0-12 months)**: SaaS + yield-share from NGO dashboard.
- **Phase 2 (12-24 months)**: BNPL origination commissions + merchant lending fees.
- **Phase 3 (24+ months)**: White-label infrastructure licensing + regional expansion.

**Defensibility**  
Asset-light, multi-lender orchestration layer + Stellar-native rails = unmatchable cost and speed. No competitor combines NGO disbursement + beneficiary BNPL on the same blockchain rails.

### 2. Phase 1 – NGO Dashboard + Stellar Disbursement Provider (The Beachhead)

**Problem**  
NGOs spend 5-15% of aid budgets on bank wires, cash logistics, and FX fees. Batch payments are slow (days), reconciliation is manual, and idle funds earn zero yield.

**Product**  
A web + mobile dashboard where NGOs:

- Upload beneficiary lists (RUT + phone).
- Approve bulk disbursements in one click.
- Send stablecoin (USDC) via **Stellar Disbursement Platform (SDP)** to thousands of recipients instantly.
- Beneficiaries receive funds in a Sozu-powered Stellar wallet (or existing wallet via deep links).

**Key Stellar Benefits Delivered**

- **Batch tx**: One transaction can contain up to 100 operations (SDP handles thousands via loops).
- **No / near-zero tx fees**: Stellar base fee ≈ 0.00001 XLM (< $0.00001 USD).
- **Yield on idle funds**: Soroban smart contracts automatically move reserves into yield-bearing pools (e.g., USDC lending protocols on Stellar). NGOs earn 4-8% APY (shared with Sozu).
- **Transparency & compliance**: On-chain audit trail + KYC/AML hooks.
- **On-demand wallets**: Recipients without wallets get one created instantly.

**Revenue (Phase 1)**

- Tiered SaaS subscription ($99–$999/month per NGO based on volume).
- 20-30% share of yield generated on disbursement float.
- Optional white-label fee for government/NGO re-branding.

**Success Metric**  
Acquire 50 NGOs → $500k+ ARR + $10M+ monthly disbursements within 12 months.

### 3. Phase 2 – BNPL Product for the Same Beneficiaries (The Killer Extension)

**Product Name (suggested)**: SozuPay BNPL

**How It Works for Beneficiaries (End Users)**

1. At any partnered merchant (physical or online), beneficiary selects “Paga con Sozu”.
2. Scans QR or opens app → wallet is already linked (from Phase 1 disbursements).
3. **Multi-lender flow** appears in <10 seconds:
   - Real-time waterfall of offers from 5+ lenders (banks, fintechs, and **merchants themselves**).
   - Transparent interest rates shown upfront (e.g., 0% merchant-subsidized, 9.9% APR, 18% APR).
   - Customer chooses best option (term, rate, down-payment).
4. Instant approval (uses Stellar wallet history + open finance data + NGO verification).
5. Product is delivered immediately.
6. Repayments auto-deduct from future NGO disbursements or wallet balance (Stellar payments — again near-zero fees).

**Merchant-as-Lender Feature (Unique Moat)**

- Any merchant can:
  - Deposit capital into a Soroban lending pool.
  - Earn yield + origination fees when their capital funds BNPL loans for their own customers.
  - Or launch private-label “Store Cuotas” powered by Sozu (white-label like Wibond but multi-lender).
- Merchants become both sellers **and** lenders → higher margins and loyalty.

**Multi-Lender Orchestration**

- Neutral hub (like Creditop).
- Lenders compete on rate/fee → best terms for beneficiary, lowest cost for merchant.
- Sozu takes 1-2% origination fee per transaction (paid by lender or merchant).

**Revenue (Phase 2)**

- Origination commissions (1-2% of loan volume).
- Merchant lending pool management fee (0.5-1% AUM).
- SaaS upsell for merchant dashboard + analytics.

### 4. Technical Specifications (High-Level Architecture)

**Core Stack**

- **Frontend**: Next.js web dashboard + React Native mobile app (beneficiary & merchant).
- **Backend**: Node.js / NestJS + PostgreSQL + Redis (for real-time offers).
- **Blockchain Layer**:
  - Stellar Horizon API + SDP (open-source) for batch disbursements.
  - Soroban smart contracts for: yield pools, lending pools, escrow for BNPL repayments.
  - USDC (Circle) as primary stablecoin.
- **Multi-Lender Engine**:
  - API adapters to Chilean banks + fintechs (Cleo, Wibond, BancoEstado, etc.).
  - Real-time rate engine + waterfall logic (custom scoring model).
  - Open Finance / SBIF data integration for risk.
- **Identity & Compliance**: RUT + facial biometrics + Stellar wallet KYC hooks.
- **Payments Rail**: All inflows/outflows on Stellar → sub-second finality, batchable, near-zero cost.
- **Security**: MPC wallets, audited Soroban contracts, SOC2 compliance path.

**Key Technical Differentiators**

- Single source of truth: beneficiary wallet links NGO disbursements → BNPL history → repayments.
- Batch + yield automation reduces ops cost by >90% vs traditional rails.
- Merchant-as-lender portal uses Soroban to let SMEs deploy capital on-chain without becoming banks.

**MVP Scope (Phase 1 Launch)**

- NGO dashboard + SDP integration.
- Basic beneficiary wallet.
- Yield dashboard (Soroban pool).
- Pilot with 3 NGOs.

**Phase 2 MVP**

- QR checkout flow.
- 3 initial lenders + 5 pilot merchants (who also act as lenders).
- Transparent rate comparator UI.

### 5. Full Business Model Summary

| Revenue Stream               | Phase 1  | Phase 2 | Projected Year-2 Revenue |
| ---------------------------- | -------- | ------- | ------------------------ |
| NGO SaaS subscription        | Yes      | Yes     | $1.2M                    |
| Yield share on float         | Yes      | Yes     | $800k                    |
| BNPL origination fees        | –        | Yes     | $2.5M+                   |
| Merchant lending pool fees   | –        | Yes     | $900k                    |
| White-label / infrastructure | Optional | Yes     | $1M+                     |

**Unit Economics (Target)**

- CAC for NGO: $800 (partnerships + inbound).
- LTV: $25k+ (multi-year + BNPL volume).
- Gross margin: 75-85% (Stellar keeps variable costs near zero).

### 6. Roadmap & Milestones (2026-2028)

- **Q2-Q3 2026**: MVP dashboard + SDP live. Sign first 10 NGOs.
- **Q4 2026**: Yield pools live + first $5M disbursed.
- **Q1 2027**: BNPL beta with 20 merchants (including merchant-as-lender).
- **Q3 2027**: Multi-lender production (10+ lenders).
- **2028**: Expand to Peru + white-label API for banks.

### 7. Risks & Mitigations

- Regulatory: Partner with CMF-licensed entities for credit -> _CONOMYHQ_; Stellar is already compliant for payments.
- Adoption: Start with NGOs that already use digital aid (UNDP-style).
- Lender liquidity: Seed pools with merchant capital + institutional partners.
