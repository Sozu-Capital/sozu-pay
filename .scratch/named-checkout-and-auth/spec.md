# Spec: Seamless Staff door + Named Standing Checkout URLs

**Status:** ready-for-agent

Parent effort: staff can sign in with Google without leaving the tab, and merchants own durable named payment URLs that survive each sale.

## Problem Statement

Staff who tap Continue with Google get a second tab or popup. On phones that tab is easy to lose; on desktop popup blockers make login feel broken. Passkey and PIN sit behind a mode switch that unmounts Google, so the **Staff door** feels like three products.

Separately, every merchant **Checkout** is an opaque `/checkout/cs_…` id that dies after payment or after a short TTL. María cannot print `pay.sozu.capital/maria-cafe/almuerzo` on the window, keep using it after lunch rush, turn it off at night, or set a deadline when she creates it. When a link is dead today, the payer sees “not found” instead of her store.

## Solution

Keep people in the current tab for **Same-window Google**. Polish the **Staff door** so Google, passkey, and PIN feel like one surface.

Give merchants a **Standing checkout** whose public address is a **Named Checkout URL** `/{store-slug}/{checkout-slug}`. The same URL stays payable after each sale. The merchant can leave it live, turn it off, or attach a **Checkout deadline** from create. An **Inactive checkout** redirects to that store's **Store landing page**. **POS checkouts** stay on opaque short-lived URLs.

## User Stories

1. As a staff member, I want Continue with Google to stay in this tab, so I never hunt for a popup or a second browser window.
2. As a staff member on iPhone Safari, I want Google to return me to SozuPay in the same tab, so I am not stranded in a blank popup.
3. As a staff member in an in-app WebView, I want Google not to open Chrome as a separate app, so login feels in-app.
4. As a staff member, I want the **Staff door** to keep Google visible while I pick passkey or PIN, so switching method is not a different product.
5. As a returning merchant, I want the door to remember I used passkey last time, so I am not forced through Google first every morning.
6. As an NGO operator, I still want Google as the primary CTA, so the Pollar path stays the default.
7. As a staff member with one Organization, I want to land on the dashboard after Google, so I skip the org picker.
8. As a staff member with several Organizations, I want the org picker after Google, so I choose the workspace I meant.
9. As an invitee opening a **Staff invite**, I want Google to return me to the join URL, so I am not dumped on home.
10. As a staff member who already has a session, I want visiting `/` to continue into my org, so login is not a speed bump.
11. As a staff member who tapped Log out, I want a fresh **Staff door**, so I can switch Google accounts.
12. As María the merchant, I want a **Named Checkout URL** that contains my store name and the checkout name, so the link looks like my space on the internet.
13. As María, I want `/maria-cafe/almuerzo` to keep working after each sale, so I can print it once.
14. As María, I want to turn almuerzo off after hours, so nobody pays an overnight price.
15. As María, I want the old WhatsApp link to open my **Store landing page** when almuerzo is off, so I still own `/maria-cafe`.
16. As María, I want to create a checkout with a **Checkout deadline** from the start, so a weekend pop-up dies on Monday without me remembering to toggle it.
17. As María, I want to change the deadline later, so rain can extend the patio menu.
18. As María, I want to turn a checkout back on, so the same URL works again.
19. As María, I want the **Checkout slug** to be my words (`almuerzo`, `propina`), so I do not send customers a `cs_` id.
20. As María, I want the **Store slug** to be my **Org Sozu tag** when I have one, so `$maria-cafe` and `/maria-cafe` are the same name.
21. As María without a tag yet, I want a unique slug from my store name, so I still get a public URL on day one.
22. As María, I want `/maria-cafe` to show my live standing offers, so a customer who only has the store name can still pay.
23. As a customer who follows a dead checkout slug on a real store, I want the store page, so I can pick another live offer.
24. As a customer who types a store slug that does not exist, I want a not-found page, so I am not sent to SozuPay marketing home.
25. As a cashier, I still want a **POS checkout** QR that expires in minutes, so an abandoned till QR cannot be paid later.
26. As a cashier, I do not want creating a POS charge to destroy María's standing `/maria-cafe/almuerzo` URL.
27. As a customer with an old `/checkout/cs_…` link, I want it to keep working while it is pending, so we do not break WhatsApp history.
28. As an NGO operator, I want a durable **Funding link** that uses the same named URL shape, so donors can bookmark `$org/junio`.
29. As Sozu Wallet, I want to recognize `/{store}/{checkout}` the same way I recognize `/checkout/{id}` and `/pay/qr/{slug}`, so a scanned named URL opens native checkout.
30. As Sozu Wallet, I want Google login to use an in-app auth session sheet, so Gmail never jumps to a Safari tab.
31. As María, I want two standing checkouts with different slugs, so lunch and tips are different URLs under the same store.
32. As María, I do not want a second store to claim `/maria-cafe`, so my name stays mine.
33. As María, I want a copy button that copies the named URL, so I never copy an internal id by mistake.
34. As a payer on a live named URL, I want to pay the standing amount, so the page is a checkout not a brochure.
35. As a payer who just paid a standing offer, I want a receipt, so I know it landed — and the next stranger can still use the same URL.
36. As María, I want each sale on a standing offer in my checkout list / receipts, so I can see today's almuerzo takes.
37. As María, I want reserved paths like `/dashboard` never to be stealable as a store slug, so product routes stay product routes.
38. As a developer, I want one resolver for “is this path a named checkout or a reserved route”, so we do not special-case every first segment in UI code.

## Implementation Decisions

- **Staff door / Same-window Google**
  - Always use the existing hosted-OAuth opener that assigns `window.location` to the Pollar Google URL after persisting `client_session_id`.
  - Stop reserving a popup. Stop branching on mobile UA. `shouldUseSameWindowOAuth` becomes always-on (or the popup path is deleted).
  - Keep `/auth/pollar/callback` as the return surface; if `window.opener` exists from old popups, still close it, but new logins will not create one.
  - Do not attempt Google GIS / FedCM in this spec. Pollar must remain the identity provider.
  - Passkey and PIN remain on the **Staff door** as secondary actions that do not unmount the Google CTA. Last successful method may be remembered in local storage for ordering, not for hiding Google.
  - Single-org skip of the picker is existing intended behavior; do not add extra hops.

- **URL anatomy**
  - Public host remains the SozuPay app (pay.sozu.capital), never credit.sozu.capital.
  - **Named Checkout URL**: `{origin}/{storeSlug}/{checkoutSlug}`.
  - **Store landing page**: `{origin}/{storeSlug}`.
  - **POS checkout** unchanged: `{origin}/checkout/{id}` and `{origin}/checkout/{id}/success`.
  - First-segment denylist = existing app routes (`api`, `dashboard`, `onboarding`, `checkout`, `auth`, `merchants`, `merchant`, `pay`, `join`, `sign`, `sdp`, `credit`, `ramp`, `login`, `auth`, plus obvious static/reserved names). A **Store slug** that collides is rejected at claim time.

- **Store slug resolution**
  - Prefer **Org Sozu tag** (normalized, no `$`).
  - Else persist a unique `store_slug` derived with the same rules as org-tag suggestion (`[a-z0-9_]`, 3–30) with a numeric suffix on collision.
  - Changing the Org Sozu tag updates the public store slug (old slug redirects to the new store landing so printed material degrades to the store, not to a stranger).

- **Standing checkout model**
  - A standing offer is a first-class row (or a checkout session subtype) with: org, checkout slug, amount, live/off, optional deadline, created-by.
  - Status for routing: `live` | `off` | `expired` (deadline). `expired` is derived from deadline, same idea as POS `effectiveCheckoutStatus`.
  - Each successful payment appends a sale/receipt. The standing row does not flip to `completed`.
  - Turning off is reversible. Deleting from the merchant UI is “off”, not destroy-the-slug, so the URL keeps redirecting to the store.
  - **POS checkout** create must not expire or replace standing offers. Today's “expire other pending sessions for this org” stays scoped to POS/ephemeral sessions.

- **Payer routing**
  - `GET /{storeSlug}/{checkoutSlug}`: if store unknown → not-found. If checkout missing, off, or past deadline → redirect to `/{storeSlug}`. If live → payer checkout UI for that standing amount (existing provider/wallet path).
  - `GET /{storeSlug}`: store not-found or the landing (name + live standing offers).
  - Inactive named URLs never 404 when the store slug is valid.

- **Dashboard**
  - Create-checkout for standing offers collects checkout slug, amount, optional deadline, live-by-default.
  - List shows the named URL, on/off, deadline, last sale. Copy copies the named URL.
  - POS page continues to create **POS checkouts** only.

- **Wallet / Expo**
  - This repo publishes the URL contract (see `expo-wallet-contract.md`). Wallet implementation is a separate repo; do not add Expo runtime here.

## Testing Decisions

- Test external behavior, not React trees or SQL column names.
- Highest seam: pure URL + routing helpers next to today's `checkout-url` and `expiration` modules.
  - Named URL builders.
  - Path parse: reserved vs store landing vs named checkout.
  - Effective standing state: live / off / expired-by-deadline.
  - Inactive destination: always the store landing for that slug.
  - POS expire-others must not select standing offers (behavior test on the helper that chooses what to expire).
  - Same-window Google: `shouldUseSameWindowOAuth` (or its replacement) is true for desktop and mobile UAs; popup reservation is a no-op.
- Prior art: `src/lib/checkout-url.test.ts`, `src/lib/checkout/expiration.test.ts`, `src/lib/pollar/oauth-resume.test.ts`.
- Playwright only for a smoke of callback path if a Pollar fake-auth path already exists; do not block on live Google.

## Out of Scope

- Custom domains / bring-your-own DNS.
- Open-amount standing offers (payer types the price).
- Dropping passkey/PIN from the merchant **Staff door**.
- Replacing Pollar with first-party Google OAuth.
- GIS One Tap / FedCM.
- Changing POS TTL policy.
- Implementing Sozu Wallet screens in this repo.
- Card rails (SumUp / MercadoPago).

## Further Notes

- Matt Pocock `/to-prd` is `/to-spec`; this file is that spec.
- Grill answers: `.scratch/named-checkout-and-auth/grill-record.md`.
- Expo companion: `.scratch/named-checkout-and-auth/expo-wallet-contract.md`.
- Glossary: `CONTEXT.md`. ADRs: `0002-named-standing-checkout-urls`, `0003-same-window-google`.
