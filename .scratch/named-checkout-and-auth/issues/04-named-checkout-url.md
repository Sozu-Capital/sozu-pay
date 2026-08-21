# 04: Named Checkout URL anatomy

**What to build:** A live **Standing checkout** is addressable as `/{store-slug}/{checkout-slug}`. Helpers build and parse that URL. **POS checkout** URLs stay `/checkout/{id}`.

**Blocked by:** 03

**Status:** done

- [x] `namedCheckoutUrl(storeSlug, checkoutSlug)` returns `{origin}/{store}/{checkout}` on the SozuPay host
- [x] Path parse distinguishes reserved routes, store landing, and named checkout
- [x] Checkout slug rules match public-name constraints (lowercase, unique per store)
- [x] Existing `checkoutSessionUrl` behavior for POS ids is unchanged
- [x] Tests live next to `checkout-url` tests
