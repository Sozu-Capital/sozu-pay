# SDP testnet E2E — local SDP + deployed wallet (`credit.sozu.capital`)

Use this when the **recipient wallet** runs on production (`https://credit.sozu.capital`) while the **disbursement operator** is still **local Docker SDP** on **testnet**. You get real Horizon transaction hashes without resetting your disbursement batch.

**Architecture:** [sozupay_mvp](https://github.com/blessedux/sozupay_mvp) = NGO operator UI. [SozuCredit](https://github.com/blessedux/SozuCredit) = recipient wallet (SDP routes, `stellar.toml`, `/sdp/register`).

---

## 1. Deploy wallet (SozuCredit) first

Set these in **Vercel → SozuCredit project → Environment Variables** (Production + Preview for test passes):

| Variable | Example (testnet + prod domain) |
|----------|----------------------------------|
| `SDP_ALLOWED_DOMAINS` | `bluecorp.stellar.local:8000` (local SDP); add partner hosts when live |
| `WALLET_CLIENT_DOMAIN` | `credit.sozu.capital` |
| `SEP10_CLIENT_SIGNING_SECRET` | Dedicated **testnet** secret (`S...`); fund public key on testnet |
| `AUTH_SECRET` | Long random string (invite cookie signing) |
| `STELLAR_NETWORK` | `testnet` (or unset → testnet passphrase in code paths) |
| `NEXT_PUBLIC_APP_URL` | `https://credit.sozu.capital` |
| `NEXT_PUBLIC_STELLAR_NETWORK` | `testnet` |

Redeploy after saving env.

**Preflight (terminal, from any machine):**

```bash
curl -fsS "https://credit.sozu.capital/.well-known/stellar.toml" | head -5
# Expect: VERSION=, SIGNING_KEY=G..., not "# SEP10_CLIENT_SIGNING_SECRET is not set"
```

Or run the repo script:

```bash
./scripts/sdp-preflight.sh --prod-domain credit.sozu.capital
```

---

## 2. Point local SDP wallet at production (keep batch)

Do **not** drop Docker volumes. Update the **Sozu** wallet row and resend invitations.

**SQL (bluecorp tenant):**

```bash
docker exec sdp-db-1 psql -U postgres -d sdp_mtn -c "
UPDATE sdp_bluecorp.wallets
SET
  homepage = 'https://credit.sozu.capital',
  deep_link_schema = 'https://credit.sozu.capital/sdp/invite',
  sep_10_client_domain = 'credit.sozu.capital',
  updated_at = now()
WHERE name = 'Sozu';
"
```

**SDP must reach your TOML over HTTPS** (from the `sdp-api` container):

```bash
docker exec sdp-sdp-api-1 wget -qO- "https://credit.sozu.capital/.well-known/stellar.toml" | head -3
```

In SDP admin (`http://bluecorp.stellar.local:3000`): open your disbursement → **Resend wallet invitations** so short links embed `credit.sozu.capital` (old `/r/...` rows still point at ngrok until regenerated).

**Invite links (DRY_RUN):**

```bash
docker compose --project-name sdp logs sdp-api 2>&1 | grep "Content: You have a payment" | tail -3
```

---

## 3. Browser E2E (production wallet UI)

For each recipient in the batch:

1. Open `http://bluecorp.stellar.local:8000/r/<short_id>` (or full signed URL from logs).
2. Land on `https://credit.sozu.capital/sdp/invite?...` → login with passkey (`/auth?sdpInvite=1`) → `/sdp/register`.
3. **SEP-10** (passkey sign) → **SEP-24** (SDP verification UI).
4. Confirm in SDP admin: receiver wallet has a **G…** Stellar address.

Then **start / approve** the disbursement in SDP so TSS submits testnet payments.

---

## 4. Collect testnet transaction hashes (terminal)

Replace disbursement id if needed:

```bash
DISBURSEMENT_ID="4d2bdc67-0bef-4f12-9ab9-304ae4b1663b"

docker exec sdp-db-1 psql -U postgres -d sdp_mtn -c "
SELECT r.external_id, p.amount, p.status,
       p.stellar_transaction_id, p.stellar_operation_id
FROM sdp_bluecorp.payments p
JOIN sdp_bluecorp.receivers r ON r.id = p.receiver_id
WHERE p.disbursement_id = '${DISBURSEMENT_ID}'
ORDER BY r.external_id;
"
```

**Horizon / explorer links:**

- `https://stellar.expert/explorer/testnet/tx/<stellar_transaction_id>`
- `https://horizon-testnet.stellar.org/transactions/<stellar_transaction_id>`

You want **two non-empty `stellar_transaction_id` values** (one per micropayment) for readiness evidence.

**Optional — verify on Horizon:**

```bash
HASH="<paste_stellar_transaction_id>"
curl -s "https://horizon-testnet.stellar.org/transactions/${HASH}" | jq '.successful, .ledger'
```

---

## 5. Readiness evidence checklist

- [ ] `curl` TOML on `credit.sozu.capital` returns `SIGNING_KEY`
- [ ] Screen recording: invite → auth → SEP-10 → SEP-24
- [ ] Two testnet payment tx hashes (DB query above)
- [ ] SDP version / commit noted; client domain `credit.sozu.capital`; deep link `https://credit.sozu.capital/sdp/invite`
- [ ] Operator wallet values match [sdp-wallet-operator-checklist.md](sdp-wallet-operator-checklist.md)

---

## Order of operations (this sprint)

1. **Commit / push** SozuCredit (middleware + any SDP fixes) and dashboard (docs + `fetchSdpToml`).
2. **Deploy** SozuCredit with env vars → preflight `curl` green.
3. **Local terminal:** SQL wallet update, `wget` TOML from container, resend invites, run E2E in browser on **credit.sozu.capital**.
4. **SQL** → copy both `stellar_transaction_id` hashes into readiness notes / Notion.

Local-only dev (no prod domain): see [sdp-local-e2e.md](sdp-local-e2e.md).
