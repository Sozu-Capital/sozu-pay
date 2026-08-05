# SozuPay Dashboard

Merchant and NGO dashboard for managing organizations, treasuries, and disbursements on Stellar. For **NGOs**, staff identity and the **Org treasury wallet** are provided via **Pollar**. Merchant (`store`) path stays on the legacy passkey / PIN model until a separate initiative.

## Language

### Identity & access

**User**:
A person who can log into the dashboard and access one or more organizations.
_Avoid_: Account, member (unless referring to org membership)

**Pollar login**:
How a User authenticates to the dashboard for the NGO path. V1: Google only via Pollar. Establishes the dashboard session via a **Staff Pollar identity**. Does not make that identity the org's spending wallet.
_Avoid_: Social login (without Pollar), OAuth (in user-facing language), sign-in with Google (as if SozuPay owned the OAuth app), email OTP / GitHub / passkey (as NGO v1 login options)

**Sozu tag**:
An optional public handle (e.g. `$maria-ngo`) on a **User**, used as a human-readable payment address — not for login. Under **Pollar login**, auth is Google; the tag may be set later via soft prompt or settings.
_Avoid_: Username (as auth identifier), tag (without "Sozu")

**Org Sozu tag**:
An optional public handle on an **Organization** used as the org's human-readable receive address.
_Avoid_: Org username

**Legacy NGO org** / **Pollar migration**:
Cancelled for this initiative — existing NGO rows are test data. Clean break to Pollar; optional one-shot DB reset script. Not a user-facing product.
_Avoid_: Migration wizard, dual-run (for NGOs in this initiative)

### Organizations & money movement

**Organization**:
A workspace a User belongs to. Tax entity type is `ngo` (distribution / microcredit partner) or `store` (merchant).
_Avoid_: Account, tenant, microcredit org (use NGO / distribution org)

**NGO**:
An **Organization** with type `ngo` — runs distributions / disbursements to recipients. Includes microcredit partners.
_Avoid_: Microcredit org (as a separate type), nonprofit (unless legal entity language)

**Disbursement**:
A batch payout from an NGO's funds to one or more recipients.
_Avoid_: Payout batch (unless referring to a specific SDP object), transfer (alone)

**Org treasury wallet**:
The single Pollar-managed Stellar wallet that holds an **Organization**'s operating funds and is the source of **Disbursements**. Provisioned per org (not per staff login); access to spend is gated by SozuPay roles on the acting **User**.
_Avoid_: Member wallet, personal wallet, passkey smart account (for NGO staff target model)

**NGO onboarding (Pollar path)**:
The new-staff happy path: **Pollar login** → create **Organization** (name) → dashboard with empty **Org treasury wallet** and a fund CTA. No passkey, PIN, or smart-account linking steps. Join-by-invite is a secondary entry, not the primary CTA. Org picker only when the User already belongs to more than one org. Optional **Sozu tag** / **Org Sozu tag** are not required at create — a dismissible soft prompt on first dashboard landing nudges the User to add them.
_Avoid_: Wallet setup, smart wallet onboarding (for new NGOs)

**Disbursement confirmation**:
The in-app review step before a **Disbursement** spends from the **Org treasury wallet** — shows totals / recipients and requires an explicit Confirm. No passkey, PIN, or Pollar re-OTP in v1; authorization is session + SozuPay role, with the acting **User** recorded in the audit log.
_Avoid_: Signing ceremony, authorize with passkey

**Checkout**:
A shareable payment session with an amount and URL. Merchants use it to get paid; **NGOs** use the same primitive as a **Funding link** to top up the **Org treasury wallet**.
_Avoid_: Invoice (unless a distinct billing object is introduced)

**Funding link**:
An NGO-facing name for a **Checkout** session whose settlement destination is the **Org treasury wallet**. Same create/share UX as merchant get-paid; different nav copy and settle-to address.
_Avoid_: Donation link (unless the org explicitly frames it as donations), merchant checkout (in NGO UI copy)

**NGO dashboard (v1)**:
The primary nav for distribution operators: Home (balance + fund CTA), **Funding links**, **Disbursements** (and history), **Recipients**, Transactions, Settings. Vault, credit, walls, payouts, keys, and admin are out of the primary nav for this simplification (may remain reachable later or under a deferred “More”).
_Avoid_: Full merchant nav, keys page (as a primary NGO surface)

**Staff invite**:
A one-time, expiring link that lets another person join an **Organization** after **Pollar login** (Google). The invitee’s Google account does not need to match a pre-specified email; the inviter sets the role when creating the link.
_Avoid_: Email-match invite (for NGO v1), magic link (legacy auth term)

**Staff Pollar identity**:
The Pollar login belonging to an individual **User** (Google in NGO v1). Used to authenticate to the dashboard. Distinct from the **Org treasury wallet** — staff identity does not hold the NGO's operating float.
_Avoid_: Personal wallet (when meaning spending wallet), member smart account

### Legacy (being retired for NGO staff)

**Passkey**, **Backup PIN**, **Magic link login**, **Recovery email**, **Synthetic email**, **PIN-derived signer**, **Auth method** (`passkey` / `pin_login` / `magic_link`), **Signing method** (passkey vs PIN):
Legacy SozuPay-owned identity and signing model. Superseded for new NGO staff by **Pollar login** + Pollar-managed wallet (decision: Pollar owns both identity and spending wallet).

## Relationships

- A **User** authenticates via **Pollar login** (**Staff Pollar identity**) and may access one or more **Organizations** (NGO path)
- A **User** may have zero or one **Sozu tag** (optional; for payments / display — never for auth under the NGO Pollar path)
- An **Organization** may have zero or one **Org Sozu tag**
- An **NGO** has exactly one **Org treasury wallet** (server-provisioned against the org, not against a staff login)
- An **NGO** runs **Disbursements** that spend from its **Org treasury wallet**
- An **NGO** tops up its **Org treasury wallet** via a **Funding link** (Checkout primitive, NGO-skinned; settlement destination = org treasury)
- An authorized **User** triggers a spend after **Disbursement confirmation**; SozuPay checks roles, then the backend asks Pollar to execute from the **Org treasury wallet** (target). Actor attribution lives in SozuPay audit logs.
- **Fallback if Pollar cannot server-spend**: **Org treasury wallet** remains bound to the creator’s **Staff Pollar identity**; other staff queue disbursements and the wallet owner approves (approval-request UX)
- NGO passkey dual-run / migration UI is out of scope — clean break + optional test-data reset; merchants remain on passkey
- **NGO dashboard (v1)** is the default surface for distribution operators; advanced modules are not primary nav
- Additional staff join via **Staff invite** (expiring link → Google **Pollar login** → membership + role)

## Example dialogue

> **Dev:** "Maria signs in with Google via Pollar. Does she still get a passkey prompt to start a disbursement?"
> **Domain expert:** "No. Her **Staff Pollar identity** opens the dashboard; the **Org treasury wallet** moves the money after SozuPay role checks."

> **Dev:** "Must she pick a Sozu tag before she can create her NGO?"
> **Domain expert:** "No. Tag is optional — she can add `$maria` later so people can pay her by handle. Login is still Google."

> **Dev:** "Carlos needs to run payroll while Maria is on vacation. Can he?"
> **Domain expert:** "Yes under the target model — if he has treasury permission, the backend spends from the shared **Org treasury wallet**. If we had to take the fallback, he'd queue it for Maria to approve."

> **Dev:** "How does María fund the org without pasting a Stellar address on WhatsApp?"
> **Domain expert:** "She creates a **Funding link** — same **Checkout** under the hood as merchants — shares the URL, payers use whatever methods Checkout already supports; USDC lands in the **Org treasury wallet**. Fancy card rails are a later Checkout upgrade."

> **Dev:** "Who can start a disbursement — and do they Face ID?"
> **Domain expert:** "Anyone with treasury permission. They get **Disbursement confirmation** (review + Confirm), not a passkey. We log who confirmed."

> **Dev:** "What about the old passkey test NGOs?"
> **Domain expert:** "Throw them away — reset test data if needed. No migration product."

> **Dev:** "Maria WhatsApps Carlos an invite. His Google is personal Gmail, not ngo.org. Can he join?"
> **Domain expert:** "Yes — **Staff invite** is a link, not an email match. He Google-signs in and lands in the org with the role she picked."

> **Dev:** "When do they set $fundacion?"
> **Domain expert:** "After first landing — a dismissible soft prompt. Create-org is just the org name."

> **Dev:** "What does María see in the sidebar on day one?"
> **Domain expert:** "Home, Funding links, Disbursements, Recipients, Transactions, Settings — the **NGO dashboard (v1)**. Not vault, credit, or keys."

> **Dev:** "Is a 'microcredit org' a different product type from NGO?"
> **Domain expert:** "No — it's an **NGO** (`type: ngo`) running distributions. We don't have a separate microcredit org type."

## Flagged ambiguities

- **Pollar server-spend capability**: spike required — confirm funds can move from a server-provisioned org wallet under SozuPay's secret key (or equivalent). Fallback is creator-bound wallet + approval queue.
- Email OTP / passkey login for NGOs: explicitly deferred past Google-only v1.
- Maker-checker / re-OTP for spends: deferred past v1 unless partners demand it.
- SumUp / MercadoPago-class card rail for Checkout: follow-up shared by merchants + NGOs — out of scope for this initiative.
- Merchant Pollar cutover: explicitly out of scope for this initiative (separate PRD later).
- Passkey terms remain in code for merchants; NGO path is Pollar.
- ADR recorded: `docs/adr/0001-pollar-for-ngo-staff.md`.
