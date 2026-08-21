# 03: Store slug + Store landing page

**What to build:** Each merchant/NGO org has a public **Store slug**. Visiting `/{store-slug}` shows that store's **Store landing page**. Unknown slugs are not-found. Reserved first segments cannot be claimed.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Store slug prefers **Org Sozu tag**; otherwise a unique slug from the org display name
- [ ] `/{store-slug}` renders a public landing for a known store
- [ ] Unknown store slug is not-found (not redirected to `/`)
- [ ] Reserved routes (`dashboard`, `checkout`, `auth`, …) are never captured as store slugs
- [ ] URL helper seam covers landing URL and reserved-segment rejection
- [ ] Changing Org Sozu tag moves the public slug; the old slug redirects to the new landing
