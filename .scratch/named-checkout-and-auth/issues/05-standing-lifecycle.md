# 05: Standing checkout lifecycle (live, off, deadline)

**What to build:** A merchant can create a **Standing checkout** that stays the same URL after each sale, turn it off, or give it a **Checkout deadline** from create. Off or past deadline is an **Inactive checkout** and redirects to the **Store landing page**.

**Blocked by:** 04

**Status:** done

- [x] Create standing offer: slug, amount, optional deadline, live by default
- [x] Completing a payment records a sale and leaves the offer live
- [x] Turn off → named URL redirects to `/{store-slug}`
- [x] Turn on again → same URL is payable
- [x] Past deadline behaves as inactive (redirect to store landing)
- [x] Dashboard copy copies the named URL, not a `cs_` id
- [x] POS “expire other pending” does not retire standing offers
- [x] Effective-state helper is tested like POS `effectiveCheckoutStatus`
