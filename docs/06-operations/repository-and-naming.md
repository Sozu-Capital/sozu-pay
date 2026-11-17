# Repository and naming (canonical source of truth)

This document removes confusion between **local folder names**, **npm package name**, and **GitHub remotes**.

---

## What this repo is

| Name | Meaning |
|------|---------|
| **SozuPay Dashboard** | Product name — NGO operator UI (staff login, beneficiaries, batch disbursements, reporting). |
| **sozupay-dashboard** | `package.json` name (npm). |
| **SozuPay_dashboard** | Common local clone folder on disk (your machine). |
| **sozu-pay** | **Canonical GitHub repository** (`Sozu-Capital/sozu-pay`) — where active development is pushed. Older names `sozupay_mvp` and `blessedux/sozupay_mvp` redirect here. |

This repo is **not** the Stellar Disbursement Platform (SDP) server. It is the **custom Next.js dashboard** that will talk to SDP’s API. SDP backend lives in [stellar-disbursement-platform-backend](https://github.com/stellar/stellar-disbursement-platform-backend) (vendored locally under `stellar-disbursement-platform-backend/` for Docker dev only; not committed).

---

## Git remotes (current)

| Remote | GitHub URL | Status |
|--------|------------|--------|
| **`origin`** | `https://github.com/Sozu-Capital/sozu-pay` | **Canonical.** Org-owned. GitHub redirects `blessedux/sozupay_mvp` and `Sozu-Capital/sozupay_mvp`. Use for deploy and PRs. |
| **`sozupay-other`** | `https://github.com/blessedux/SozuPay` | **Older / stale.** Last updated earlier; missing recent `main` history. Do not deploy from here without merging. |

Verify which is ahead:

```bash
git fetch origin sozupay-other
git log --oneline sozupay-other/main..origin/main | head
```

If `origin/main` has commits and the other remote does not, **`origin` wins**.

Then:

```bash
git remote set-url origin https://github.com/Sozu-Capital/sozu-pay.git
```

---

## Unify names (safe — nothing deleted)

### 1. Local folder (optional)

Rename the directory on disk for clarity:

```bash
mv ~/Desktop/SOZUCAPITAL/SozuPay_dashboard ~/Desktop/SOZUCAPITAL/SozuPay-dashboard
```

Git history and remotes are unchanged; only the path changes.

### 2. Old `SozuPay` repo on GitHub

**Do not delete** unless you are sure nothing unique exists there.

Recommended:

1. Compare: `git log sozupay-other/main..origin/main` (commits only on canonical).
2. If empty on the old side, edit **SozuPay** repo description: *“Deprecated — use Sozu-Capital/sozu-pay (SozuPay Dashboard).”*
3. Or archive the old repo in GitHub Settings (read-only, not deleted).

### 3. Document in README

README title stays **SozuPay Dashboard**; canonical repo line is `Sozu-Capital/sozu-pay`.

---

## Related repositories

| Repo | Role |
|------|------|
| **[sozu-pay](https://github.com/Sozu-Capital/sozu-pay)** (this) | NGO / store dashboard — deploy to **Vercel** |
| **[sozu-wallet](https://github.com/Sozu-Capital/sozu-wallet)** | Recipient wallet — deploy to **Vercel** (`app.sozu.capital`) |
| **stellar-disbursement-platform-backend** | Official SDP — deploy to **containers + Postgres** (not Vercel) |

See [sdp-ngo-platform-deployment.md](../04-integrations/sdp-ngo-platform-deployment.md) for how these connect in production.
