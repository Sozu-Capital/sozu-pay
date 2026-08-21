# 04: Named Checkout URL anatomy

**What to build:** A live **Standing checkout** is addressable as `/{store-slug}/{checkout-slug}`. Helpers build and parse that URL. **POS checkout** URLs stay `/checkout/{id}`.

**Blocked by:** 03

**Status:** ready-for-agent

- [ ] `namedCheckoutUrl(storeSlug, checkoutSlug)` returns `{origin}/{store}/{checkout}` on the SozuPay host
- [ ] Path parse distinguishes reserved routes, store landing, and named checkout
- [ ] Checkout slug rules match public-name constraints (lowercase, unique per store)
- [ ] Existing `checkoutSessionUrl` behavior for POS ids is unchanged
- [ ] Tests live next to `checkout-url` tests
