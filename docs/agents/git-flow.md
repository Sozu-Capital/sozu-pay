---
trunk: prod
featureBase: dev
deployTrigger: prod
promotionChain:
  - dev
  - prod
---

# Git flow for this repo

**Model**: simple-develop-trunk (branch names `dev` → `prod`)

**Promotion chain**: `dev` → `prod`

- **featureBase** (`dev`) — new feature PRs target this branch. This is the shared test / preview environment.
- **deployTrigger** (`prod`) — merge here deploys **Production** on Vercel (`pay.sozu.capital`).

`main` still exists as a historical default. Do not merge new work into `main`; promote `dev` → `prod`.

## How skills use this file

- `/ship-ticket` reads `featureBase` to set the base branch of new PRs.
- `/setup-merge-hook` reads `deployTrigger` to set the `on.pull_request.branches` filter for the GitHub Action.
- The Action scans **Rollup PRs** (PRs that promote work between chain nodes) for child PR references in commit messages so Tickets linked to feature PRs are still promoted when their work reaches the deployTrigger through the chain.
