# 07: Expo wallet contract for named URLs and in-app Google

**What to build:** Publish and honor a contract Sozu Wallet (Expo) can implement: parse **Named Checkout URLs** like today's `/checkout/{id}` and `/pay/qr/{slug}`, and keep Google inside an in-app auth session sheet. This ticket is the contract + any dashboard URL shapes the wallet already consumes; native screens land in the wallet repo.

**Blocked by:** 04

**Status:** ready-for-agent

- [ ] Contract file lists exact URL patterns and inactive-redirect behavior
- [ ] QR / pasted pay.sozu.capital URLs that match `/{store}/{checkout}` are documented as wallet-openable
- [ ] Inactive named URLs are documented as “follow redirect to store landing” (or open native store landing)
- [ ] Google in the wallet is documented as `openAuthSessionAsync` / AuthSession, never a Safari/Chrome tab
- [ ] POS and pizza slug routes remain documented so the wallet does not regress
