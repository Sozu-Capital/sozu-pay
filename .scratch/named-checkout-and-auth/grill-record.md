# Grill record — Staff door + Named Checkout URLs

This session ran `/grill-with-docs` as a cloud agent (no live interview rounds). Frontier questions were answered from the user's brief, `CONTEXT.md`, and the current codebase. Reopen any decision here rather than inventing a second glossary.

`/to-prd` is Matt Pocock `/to-spec` (renamed July 2026). `/to-expo` is not in mattpocock/skills; this effort treats it as: install Expo skills globally, then publish a Sozu Wallet companion contract for named URLs and in-app Google.

## Design tree (settled)

1. **What is “seamless auth access”?**
   - One **Staff door**. Google is the primary CTA. Passkey and PIN stay on the same screen as quieter options. Switching method must not feel like leaving the product.
   - Returning users should land in the dashboard (or their one org) without extra bounces when they already have a session.

2. **How does Gmail/Google stay in-app with no extra tab?**
   - **Same-window Google** for every client, not only mobile UA. Retire the popup reservation.
   - Pollar still hosts Google OAuth. We cannot swap in GIS One Tap without Pollar accepting that token. Callback path `/auth/pollar/callback` already exists.

3. **What is the public checkout URL?**
   - **Named Checkout URL**: `/{store-slug}/{checkout-slug}` on pay.sozu.capital.
   - Store slug = **Org Sozu tag** if set, else unique slug from org name.
   - Checkout slug = merchant-chosen, unique per store.

4. **Does a sale kill the link?**
   - No. **Standing checkout**. Same URL after every sale until off or past **Checkout deadline**.

5. **Merchant controls?**
   - Keep live, turn off, or set a deadline at create (and later). Off / past deadline → **Inactive checkout** → **Store landing page** `/{store-slug}`.

6. **What about today's `/checkout/cs_*` and POS?**
   - **POS checkout** stays opaque + short TTL. Legacy `/checkout/{id}` keeps working. Named URLs are the standing/public shape.

7. **Unknown store vs inactive checkout?**
   - Known store + inactive/missing checkout slug → store landing.
   - Unknown store slug → not-found. Do not send people to `/`.

8. **Open amount / custom domains?**
   - Deferred. v1 standing offers have a merchant-set amount. Ownership v1 is the path slug, not a custom domain.

## Facts (not decisions)

- Checkout URLs today: `checkoutSessionUrl` → `{base}/checkout/{sessionId}`.
- POS TTL default 15 minutes; create expires other pending sessions for the org.
- Completed `/checkout/{id}` shows “Payment complete”, not a store page.
- Pollar `shouldUseSameWindowOAuth` is UA-gated to iPhone/iPad/iPod/Android.
- Org Sozu tag lives on `profiles.username` via `organizations.sozu_tag_auth_user_id`, not a column named `slug`.
- Reserved first path segments include `api`, `dashboard`, `onboarding`, `checkout`, `auth`, `merchants`, `pay`, `join`, `sign`, `sdp`, `credit`, `ramp`, `login`.
