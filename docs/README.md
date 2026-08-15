# SozuPay Dashboard — Documentation

This repo is the **NGO Dashboard (SozuPay)** for the Sozu stack: beneficiary management, disbursement schedules, batch USDC payouts, repayment tracking, and reporting. The first deployment is **Year 1 NGO microcredit** in Argentina (partner: MUJERES 2000) on Stellar + Soroban + USDC.

Docs are grouped by purpose. Read in the order below for a clear picture; use the folder list to jump to a topic.

---

## How it fits together

- **Strategy and product:** Sozu is financial infrastructure (self-custody, transparency, programmable money). Year 1 = NGO disbursement + Sozu Wallet + offramp; Year 2+ = merchant settlement; Year 4 = own the rail. This dashboard is the NGO control plane: staff manage beneficiaries, approve disbursements, confirm repayments, and run reports.
- **Technical flow:** Staff log in (Privy), pick an organization, and use the dashboard. The org has a wallet (classic G or Soroban contract C) that holds USDC; payouts go to recipient Stellar addresses. Persistence and batch execution are in progress; runbooks describe local dev and env.
- **Current work:** 30-day sprint (landing, SDP provider registration, dashboard MVP with single on-chain payout). Full Year 1 scope is in the NGO dev plan and production-disbursements tasks; todo.md is the task checklist.

---

## Reading order (reviewers)

1. **[00-overview/onepager.md](00-overview/onepager.md)** — What Sozu is, strategy (Year 1/2/4), why Stellar/Latam, Phase 1 pillars.
2. **[00-overview/technical-spec.md](00-overview/technical-spec.md)** — Product and tech summary: stack, user flows, dashboard capabilities (foundation for merchant and NGO use).
3. **[00-overview/roadmap.md](00-overview/roadmap.md)** — Development phasing: Year 1 (NGO OS), Year 2 (merchant + anchor path), Year 4 (rail); links to sprint and dev plans.
4. **[03-planning/todo.md](03-planning/todo.md)** — Task list: Phase 1–10 (done), current NGO focus and checklist.
5. **[06-operations/runbooks.md](06-operations/runbooks.md)** — Local run, env vars, health check, plug-in points.

For architecture, contracts, or integrations, use the folders below.

---

## Folder layout

| Folder | Contents |
|--------|----------|
| **00-overview** | Strategy and product: onepager, technical spec, roadmap. Start here. |
| **01-architecture** | System design: microcredit disbursement E2E, self-custodial auth, org wallet, smart accounts (G vs C), login flow. |
| **02-contracts** | Soroban: disbursement wallet contract, yield router spec, testnet contract addresses (USDC, Blend, factory). |
| **03-planning** | Execution: 30-day sprint plan, Instawards Week 1 / Week 2 changelogs, NGO disbursement dev plan (MUJERES 2000), production-disbursements tasks, todo. |
| **04-integrations** | SDP wallet registration (readiness, operator checklist, local E2E, **testnet + prod domain E2E**, passkey spec); e-commerce widget/API; E2E payout test (recipients persistence, multi-recipient, Classic vs Soroban). |
| **05-requirements** | Non-functional requirements (performance, availability, compliance), partner PDF (MUJERES 2000 functional requirements). |
| **06-operations** | Runbooks: local dev, env vars, out-of-scope plug-in points; **repository naming**; SDP NGO deploy overview linked from integrations. |
| **07-reference** | Schema (Supabase users, organizations, recipients), phase spec (Privy + wallet + KYC), codebase cleanup notes, performance analysis. |

---

## Key references

- **First NGO partner:** [05-requirements/Requerimientos_funcionales_MUJERES_2000.pdf](05-requirements/Requerimientos_funcionales_MUJERES_2000.pdf)
- **Instawards Week 1 (merchant foundation):** [03-planning/INSTAWARDS_WEEK1_ROUND1_CHANGELOG.md](03-planning/INSTAWARDS_WEEK1_ROUND1_CHANGELOG.md)
- **Instawards Week 2 (POS & dynamic payments, prod):** [03-planning/INSTAWARDS_WEEK2_POS_CHANGELOG.md](03-planning/INSTAWARDS_WEEK2_POS_CHANGELOG.md)
- **NGO dev plan and milestones:** [03-planning/ngo-disbursement-wallet-dev-plan.md](03-planning/ngo-disbursement-wallet-dev-plan.md)
- **Batch disbursement and persistence:** [03-planning/production-disbursements-tasks.md](03-planning/production-disbursements-tasks.md)
- **E2E architecture:** [01-architecture/architecture-microcredit-disbursement.md](01-architecture/architecture-microcredit-disbursement.md)
- **SDP readiness (snapshot + checklist):** [04-integrations/sdp-readiness.md](04-integrations/sdp-readiness.md)
- **SDP operator allowlist values:** [04-integrations/sdp-wallet-operator-checklist.md](04-integrations/sdp-wallet-operator-checklist.md)
- **SDP local E2E runbook:** [04-integrations/sdp-local-e2e.md](04-integrations/sdp-local-e2e.md)
- **SDP NGO platform deployment (Vercel + hosted SDP):** [04-integrations/sdp-ngo-platform-deployment.md](04-integrations/sdp-ngo-platform-deployment.md)
- **SDP Railway deploy runbook (step-by-step):** [04-integrations/sdp-railway-deploy.md](04-integrations/sdp-railway-deploy.md)
- **SDP testnet E2E (local SDP + credit.sozu.capital):** [04-integrations/sdp-testnet-production-e2e.md](04-integrations/sdp-testnet-production-e2e.md)
- **Repository naming (sozupay_mvp vs local folder):** [06-operations/repository-and-naming.md](06-operations/repository-and-naming.md)
