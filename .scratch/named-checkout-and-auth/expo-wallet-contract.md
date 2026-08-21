# Expo wallet contract — Named Checkout URLs + in-app Google

This is the `/to-expo` artifact. SozuPay (this repo, Next.js) hosts the public URLs. Sozu Wallet (Expo Router, separate app — `app.sozu.capital` / credit.sozu.capital) consumes them. Do not add an `expo` dependency to sozupay_mvp.

Use Expo skills: `expo-overview` → `expo-router` (deep links / file routes) + `expo-data-fetching` (pay.sozu.capital GETs) + `expo-native-ui` / `expo-ui` (store landing + checkout sheets). For Google, use an in-app auth session, not a browser tab.

## Why this belongs next to the dashboard spec

María's ownership of `/maria-cafe/almuerzo` is worthless if a scanned QR opens Safari. The wallet must treat named URLs as first-class pay routes, the same way it already treats `/checkout/{id}` and `/pay/qr/{slug}`.

## URL patterns the wallet must parse

Host: `pay.sozu.capital` (and local/dev equivalents). Never treat `credit.sozu.capital` as the checkout host.

| Pattern | Meaning | Wallet action |
| ------- | ------- | ------------- |
| `/{storeSlug}/{checkoutSlug}` | **Named Checkout URL** | Open native standing checkout. If the HTTP response is a redirect to `/{storeSlug}`, open native **Store landing page**. |
| `/{storeSlug}` | **Store landing page** | Native store screen: name + live standing offers. |
| `/checkout/{id}` | **POS checkout** | Existing session checkout. Short TTL. |
| `/checkout/{id}/success` | POS receipt | Existing success. |
| `/pay/qr/{slug}` | Merchant QR/NFC point | Existing hop (may mint or reuse a live POS session, or pizza SKU). |
| `/checkout/pizza/{slug}` | Standing pizza SKU in wallet | Existing pizza route — do not collapse into named store URLs. |

Store slug and checkout slug: `[a-z0-9_]`, 3–30 chars. Reserved first segments are never stores: `api`, `dashboard`, `onboarding`, `checkout`, `auth`, `merchants`, `merchant`, `pay`, `join`, `sign`, `sdp`, `credit`, `ramp`, `login`.

Suggested Expo Router files in the **wallet** app (names illustrative, follow that repo's `app/` layout):

- `app/pay/[storeSlug]/index.tsx` — store landing
- `app/pay/[storeSlug]/[checkoutSlug].tsx` — standing checkout
- Keep existing checkout-session and pizza routes

QR scanner: if the scanned string is an https URL on the checkout host, parse path with the same helper the dashboard publishes conceptually (store + checkout vs reserved). Do not require a `cs_` prefix.

## Inactive checkout

Dashboard will 302 `/{store}/{checkout}` → `/{store}` when the standing offer is off or past deadline. Wallet should:

1. Request the named URL (follow redirects), or
2. Call `GET /api/checkout/named?store={storeSlug}&checkout={checkoutSlug}` (omit `checkout` for the store landing JSON).

Response `kind`: `pay` | `store-landing` | `not-found`. When `store-landing`, open native store landing (`redirect` is `/{storeSlug}`).

Do not show “payment complete” or “link not found” for an **Inactive checkout** when the store exists. Show the store.

## In-app Google (wallet)

Dashboard **Same-window Google** is a full-tab navigation. Native cannot copy that.

**Required:** `AuthSession` / `WebBrowser.openAuthSessionAsync` (iOS `ASWebAuthenticationSession`, Android Chrome Custom Tabs). The sheet is in-app. After redirect to the wallet's registered scheme / https redirect, close the sheet and finish Pollar (or wallet-equivalent) session.

**Forbidden:** `Linking.openURL` to accounts.google.com, `WebBrowser.openBrowserAsync` as a standalone Safari tab, or `window.open` inside a WebView that escapes the app.

If the wallet already uses Pollar, point `openAuthUrl` at `openAuthSessionAsync` the same way the dashboard points it at same-tab navigation.

## Associated domains / App Clip (later)

Owning the name on the internet includes opening `https://pay.sozu.capital/maria-cafe` in the app, not in Safari. That is AASA + `expo-app-clip` / associated domains on the wallet — out of this dashboard spec, listed so the URL anatomy is not designed in a way that blocks it (no hash routes, no query-only identity).

## Out of scope for the wallet in this effort

- Creating standing offers (merchant dashboard only)
- Custom domains
- Implementing these screens inside sozupay_mvp
