# Same-window Google on the Staff door

**Pollar login** currently opens Google in a reserved popup on desktop and only uses a same-tab redirect on iOS/Android user-agents. That second window is the opposite of an in-app auth experience: people lose the original tab, popup blockers fire, and mobile WebViews turn the popup into a stray browser tab.

We always continue Google OAuth in the **current tab**: persist the pending Pollar session, navigate to Google, return to `/auth/pollar/callback`, bridge to the SozuPay session. The popup reservation path is retired.

Considered and rejected: Google Identity Services / FedCM button in-page (would need Pollar to accept a GIS token; we don't control that); keep desktop popups “because the app stays loaded” (user asked for no extra tab; resume via callback is already built).

In the Expo wallet, the matching rule is an in-app auth session sheet (`openAuthSessionAsync`), never `Linking.openURL` into Safari/Chrome. That contract lives beside this dashboard change; the dashboard itself has no native sheet.
