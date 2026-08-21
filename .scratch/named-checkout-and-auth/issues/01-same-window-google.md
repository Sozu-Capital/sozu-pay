# 01: Same-window Google on the Staff door

**What to build:** Continue with Google never opens a second tab or popup. The current tab goes to Google and returns to SozuPay. Desktop and mobile behave the same.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Clicking Continue with Google does not call `window.open` for OAuth
- [ ] Pending Pollar session is persisted before navigating away
- [ ] Return lands on `/auth/pollar/callback` and bridges to the SozuPay session
- [ ] Desktop user-agents use the same path as iOS/Android
- [ ] Tests lock “always same-window” next to the existing oauth-resume tests
- [ ] Invite `returnTo` still survives the round trip
