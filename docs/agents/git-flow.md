---
trunk: main
featureBase: main
deployTrigger: main
promotionChain:
  - main
---

# Git flow

**Model:** Trunk-based. Feature branches open against `main`; merge to `main` is the deploy trigger and promotes Exponential Tickets `QA` → `DONE`.
