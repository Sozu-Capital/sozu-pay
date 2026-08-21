# 06: Payer path for named URLs

**What to build:** A customer opening a live **Named Checkout URL** can pay. Opening an inactive or unknown checkout slug on a known store lands on that store's page. Opening a completed **POS checkout** is unchanged.

**Blocked by:** 05

**Status:** ready-for-agent

- [ ] Live named URL shows (or starts) payment for the standing amount
- [ ] Inactive named URL redirects to the store landing (HTTP redirect)
- [ ] Known store + missing checkout slug → store landing, not generic “link not found”
- [ ] Unknown store → not-found
- [ ] Legacy `/checkout/{id}` pending/completed/missing behavior remains
- [ ] After a standing sale, a second visitor can still pay the same named URL
