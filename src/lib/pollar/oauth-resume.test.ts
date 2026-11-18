import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createHash } from "node:crypto";
import {
  accessTokenFromLoginResponse,
  clientSessionIdFromCallbackSearch,
  clientSessionIdFromOAuthUrl,
  hashApiKeyPrefix,
  isAllowedPollarHandoffUrl,
  isInAppBrowser,
  isPhoneLikeBrowser,
  isPollarOAuthPopupWindow,
  parsePendingPollarOAuth,
  parsePollarHandoffUrl,
  pendingOAuthFromCookieHeader,
  pollarOAuthCallbackUrl,
  pollarOAuthHandoffHref,
  pollarOAuthOpenPlan,
  pollarSessionStorageKey,
  POLLAR_DESKTOP_OAUTH_FEATURES,
  POLLAR_OAUTH_WINDOW_NAME,
  POLLAR_PENDING_OAUTH_KEY,
  sanitizeReturnTo,
  shouldReserveOAuthPopup,
  shouldUseSameWindowOAuth,
  withSessionIdOnRedirectUri,
} from "./oauth-resume.js";

const IPHONE_SAFARI =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15";
const ANDROID_CHROME = "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/122.0.0.0";
const MAC_CHROME =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/122";
const INSTAGRAM_IPHONE = "Mozilla/5.0 (iPhone) Instagram 123.0";

describe("sanitizeReturnTo", () => {
  it("accepts same-origin app paths", () => {
    assert.equal(sanitizeReturnTo("/join/abc"), "/join/abc");
    assert.equal(sanitizeReturnTo("/dashboard/settings"), "/dashboard/settings");
  });

  it("rejects open redirects", () => {
    assert.equal(sanitizeReturnTo("https://evil.example"), undefined);
    assert.equal(sanitizeReturnTo("//evil.example"), undefined);
    assert.equal(sanitizeReturnTo("\\evil"), undefined);
    assert.equal(sanitizeReturnTo(""), undefined);
  });
});

describe("clientSessionIdFromOAuthUrl", () => {
  it("reads client_session_id", () => {
    assert.equal(
      clientSessionIdFromOAuthUrl(
        "https://sdk.api.pollar.xyz/v2/auth/google?api_key=pk&client_session_id=sess-9&redirect_uri=https://pay.example/auth/pollar/callback",
      ),
      "sess-9",
    );
  });

  it("returns null when missing", () => {
    assert.equal(clientSessionIdFromOAuthUrl("https://sdk.api.pollar.xyz/v2/auth/google"), null);
    assert.equal(clientSessionIdFromOAuthUrl("not a url"), null);
  });

  it("reads the session id Pollar appends on the way back", () => {
    assert.equal(clientSessionIdFromCallbackSearch("?client_session_id=sess-9"), "sess-9");
    assert.equal(clientSessionIdFromCallbackSearch(""), null);
  });
});

describe("withSessionIdOnRedirectUri", () => {
  it("copies client_session_id onto redirect_uri", () => {
    const url = withSessionIdOnRedirectUri(
      "https://sdk.api.pollar.xyz/v2/auth/google?api_key=pk&client_session_id=sess-9&redirect_uri=https://pay.example/auth/pollar/callback",
    );
    const parsed = new URL(url);
    assert.equal(parsed.searchParams.get("client_session_id"), "sess-9");
    const redirect = new URL(parsed.searchParams.get("redirect_uri") ?? "");
    assert.equal(redirect.searchParams.get("client_session_id"), "sess-9");
    assert.equal(redirect.origin + redirect.pathname, "https://pay.example/auth/pollar/callback");
  });

  it("leaves the url unchanged when session id or redirect is missing", () => {
    const noSession = "https://sdk.api.pollar.xyz/v2/auth/google?redirect_uri=https://pay.example/";
    assert.equal(withSessionIdOnRedirectUri(noSession), noSession);
    assert.equal(withSessionIdOnRedirectUri("not a url"), "not a url");
  });
});

describe("oauth popup window", () => {
  it("recognizes only the tab opened for Google", () => {
    assert.equal(isPollarOAuthPopupWindow("pollar-oauth"), true);
    assert.equal(isPollarOAuthPopupWindow(""), false);
  });
});

describe("accessTokenFromLoginResponse", () => {
  it("extracts the Pollar access token", () => {
    assert.equal(
      accessTokenFromLoginResponse({
        success: true,
        content: { token: { accessToken: "at-1", refreshToken: "rt" } },
      }),
      "at-1",
    );
  });

  it("returns null for incomplete bodies", () => {
    assert.equal(accessTokenFromLoginResponse({}), null);
    assert.equal(accessTokenFromLoginResponse(null), null);
  });
});

describe("pollar storage helpers", () => {
  it("builds the session key Pollar restores from", () => {
    assert.equal(pollarSessionStorageKey("abc123"), "pollar:abc123:session");
  });

  it("builds the OAuth callback URL", () => {
    assert.equal(
      pollarOAuthCallbackUrl("https://pay.sozu.capital/"),
      "https://pay.sozu.capital/auth/pollar/callback",
    );
  });

  it("uses same-window OAuth only in in-app browsers", () => {
    assert.equal(shouldUseSameWindowOAuth(IPHONE_SAFARI), false);
    assert.equal(shouldUseSameWindowOAuth(ANDROID_CHROME), false);
    assert.equal(shouldUseSameWindowOAuth(MAC_CHROME), false);
    assert.equal(shouldUseSameWindowOAuth(INSTAGRAM_IPHONE), true);
    assert.equal(
      shouldUseSameWindowOAuth("Mozilla/5.0 (iPhone) AppleWebKit/605.1.15 FBAN/FBIOS FBAV/1.0"),
      true,
    );
  });

  it("reserves an OAuth popup on phones so this SozuPay tab stays alive", () => {
    assert.equal(shouldReserveOAuthPopup(IPHONE_SAFARI), true);
    assert.equal(shouldReserveOAuthPopup(ANDROID_CHROME), true);
  });

  it("does not reserve an OAuth popup in in-app browsers", () => {
    assert.equal(shouldReserveOAuthPopup(INSTAGRAM_IPHONE), false);
  });

  it("reserves an OAuth popup on desktop Mac", () => {
    assert.equal(shouldReserveOAuthPopup(MAC_CHROME), true);
  });

  it("reserves an OAuth popup on Macintosh with touch", () => {
    assert.equal(
      shouldReserveOAuthPopup(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15",
        5,
      ),
      true,
    );
  });

  it("opens iPhone and Android Google login as _blank with no features", () => {
    assert.deepEqual(pollarOAuthOpenPlan(IPHONE_SAFARI), {
      mode: "new-tab",
      target: "_blank",
      features: "",
    });
    assert.deepEqual(pollarOAuthOpenPlan(ANDROID_CHROME), {
      mode: "new-tab",
      target: "_blank",
      features: "",
    });
  });

  it("opens desktop Mac Google login as a named window with desktop features", () => {
    assert.deepEqual(pollarOAuthOpenPlan(MAC_CHROME), {
      mode: "new-tab",
      target: POLLAR_OAUTH_WINDOW_NAME,
      features: POLLAR_DESKTOP_OAUTH_FEATURES,
    });
  });

  it("treats iPadOS Macintosh+touch as _blank", () => {
    const ipadOs =
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15";
    assert.equal(isPhoneLikeBrowser(ipadOs, 5), true);
    assert.deepEqual(pollarOAuthOpenPlan(ipadOs, 5), {
      mode: "new-tab",
      target: "_blank",
      features: "",
    });
  });

  it("allows Pollar and Google handoff URLs and rejects others", () => {
    assert.equal(
      isAllowedPollarHandoffUrl("https://sdk.api.pollar.xyz/v2/auth/google?client_session_id=1"),
      true,
    );
    assert.equal(isAllowedPollarHandoffUrl("https://api.pollar.xyz/v2/auth/google"), true);
    assert.equal(isAllowedPollarHandoffUrl("https://server.api.pollar.xyz/v3/auth/google"), true);
    assert.equal(isAllowedPollarHandoffUrl("https://www.pollar.xyz/auth"), true);
    assert.equal(isAllowedPollarHandoffUrl("https://pollar.xyz/auth"), true);
    assert.equal(isAllowedPollarHandoffUrl("https://accounts.google.com/o/oauth2/v2/auth"), true);
    assert.equal(isAllowedPollarHandoffUrl("https://accounts.youtube.com/accounts"), true);
    assert.equal(isAllowedPollarHandoffUrl("https://evil.example/phish"), false);
    assert.equal(isAllowedPollarHandoffUrl("javascript:alert(1)"), false);
    assert.equal(isAllowedPollarHandoffUrl("http://sdk.api.pollar.xyz/v2/auth/google"), false);
  });

  it("parses a fresh handoff URL and rejects expired or disallowed payloads", () => {
    const now = 1_700_000_000_000;
    const url = "https://sdk.api.pollar.xyz/v2/auth/google";
    assert.equal(
      parsePollarHandoffUrl(JSON.stringify({ url, createdAt: now }), now),
      url,
    );
    assert.equal(
      parsePollarHandoffUrl(
        JSON.stringify({ url, createdAt: now - 11 * 60 * 1000 }),
        now,
      ),
      null,
    );
    assert.equal(
      parsePollarHandoffUrl(
        JSON.stringify({ url: "https://evil.example", createdAt: now }),
        now,
      ),
      null,
    );
  });

  it("builds the same-origin Google handoff href", () => {
    assert.equal(
      pollarOAuthHandoffHref("https://pay.sozu.capital/", 123),
      "https://pay.sozu.capital/auth/pollar/google?t=123",
    );
  });

  it("detects in-app browsers that swallow Google return", () => {
    assert.equal(isInAppBrowser(INSTAGRAM_IPHONE), true);
    assert.equal(
      isInAppBrowser("Mozilla/5.0 (iPhone) AppleWebKit/605.1.15 FBAN/FBIOS FBAV/1.0"),
      true,
    );
    assert.equal(isInAppBrowser("Mozilla/5.0 Line/14.0.0"), true);
    assert.equal(isInAppBrowser(IPHONE_SAFARI), false);
  });

  it("hashes api keys the way Pollar namespaces storage", async () => {
    const digest = async (data: Uint8Array) =>
      new Uint8Array(createHash("sha256").update(data).digest());
    const hash = await hashApiKeyPrefix("pk_test", digest);
    assert.equal(hash.length, 32);
    assert.match(hash, /^[0-9a-f]{32}$/);
  });
});

describe("parsePendingPollarOAuth", () => {
  it("accepts a fresh pending payload", () => {
    const now = 1_700_000_000_000;
    const raw = JSON.stringify({ clientSessionId: "sess-9", createdAt: now });
    assert.deepEqual(parsePendingPollarOAuth(raw, now), {
      clientSessionId: "sess-9",
      createdAt: now,
    });
  });

  it("rejects expired, invalid, and empty payloads", () => {
    const now = 1_700_000_000_000;
    assert.equal(
      parsePendingPollarOAuth(
        JSON.stringify({ clientSessionId: "sess-9", createdAt: now - 11 * 60 * 1000 }),
        now,
      ),
      null,
    );
    assert.equal(parsePendingPollarOAuth("{not json", now), null);
    assert.equal(parsePendingPollarOAuth("", now), null);
    assert.equal(parsePendingPollarOAuth(null, now), null);
  });
});

describe("pendingOAuthFromCookieHeader", () => {
  it("parses a SameSite pending-oauth cookie", () => {
    const now = 1_700_000_000_000;
    const raw = JSON.stringify({ clientSessionId: "sess-9", createdAt: now });
    const header = `other=1; ${POLLAR_PENDING_OAUTH_KEY}=${encodeURIComponent(raw)}; foo=bar`;
    assert.deepEqual(pendingOAuthFromCookieHeader(header, now), {
      clientSessionId: "sess-9",
      createdAt: now,
    });
  });

  it("rejects expired cookies and missing keys", () => {
    const now = 1_700_000_000_000;
    const raw = JSON.stringify({ clientSessionId: "sess-9", createdAt: now - 11 * 60 * 1000 });
    assert.equal(
      pendingOAuthFromCookieHeader(`${POLLAR_PENDING_OAUTH_KEY}=${encodeURIComponent(raw)}`, now),
      null,
    );
    assert.equal(pendingOAuthFromCookieHeader("foo=bar", now), null);
    assert.equal(pendingOAuthFromCookieHeader("", now), null);
  });
});
