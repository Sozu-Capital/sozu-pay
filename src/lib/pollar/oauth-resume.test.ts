import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createHash } from "node:crypto";
import {
  accessTokenFromLoginResponse,
  clientSessionIdFromCallbackSearch,
  clientSessionIdFromOAuthUrl,
  hashApiKeyPrefix,
  isInAppBrowser,
  isPollarOAuthPopupWindow,
  pollarOAuthCallbackUrl,
  pollarSessionStorageKey,
  sanitizeReturnTo,
  shouldReserveOAuthPopup,
  shouldUseSameWindowOAuth,
} from "./oauth-resume.js";

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

  it("uses same-window OAuth on mobile user agents", () => {
    assert.equal(
      shouldUseSameWindowOAuth(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
      ),
      true,
    );
    assert.equal(
      shouldUseSameWindowOAuth(
        "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/122.0.0.0",
      ),
      true,
    );
    assert.equal(
      shouldUseSameWindowOAuth(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/122",
      ),
      false,
    );
  });

  it("does not reserve an OAuth popup on phones", () => {
    assert.equal(
      shouldReserveOAuthPopup(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
      ),
      false,
    );
    assert.equal(
      shouldReserveOAuthPopup(
        "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/122.0.0.0",
      ),
      false,
    );
  });

  it("reserves an OAuth popup on desktop Mac", () => {
    assert.equal(
      shouldReserveOAuthPopup(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/122",
      ),
      true,
    );
  });

  it("does not reserve an OAuth popup on Macintosh with touch", () => {
    assert.equal(
      shouldReserveOAuthPopup(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15",
        5,
      ),
      false,
    );
  });

  it("detects in-app browsers that swallow Google return", () => {
    assert.equal(isInAppBrowser("Mozilla/5.0 (iPhone) Instagram 123.0"), true);
    assert.equal(
      isInAppBrowser("Mozilla/5.0 (iPhone) AppleWebKit/605.1.15 FBAN/FBIOS FBAV/1.0"),
      true,
    );
    assert.equal(isInAppBrowser("Mozilla/5.0 Line/14.0.0"), true);
    assert.equal(
      isInAppBrowser(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
      ),
      false,
    );
  });

  it("hashes api keys the way Pollar namespaces storage", async () => {
    const digest = async (data: Uint8Array) =>
      new Uint8Array(createHash("sha256").update(data).digest());
    const hash = await hashApiKeyPrefix("pk_test", digest);
    assert.equal(hash.length, 32);
    assert.match(hash, /^[0-9a-f]{32}$/);
  });
});
