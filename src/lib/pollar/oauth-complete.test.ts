import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { createHash } from "node:crypto";
import {
  completeHostedOAuthSession,
  isPollarSessionConsumed,
  isPollarSessionDead,
  isPollarSessionFailed,
  isPollarSessionReady,
  POLL_TIMEOUT_MS,
  waitForPollarSessionReady,
} from "./oauth-complete.js";
import { hashApiKeyPrefix, pollarSessionStorageKey } from "./oauth-resume.js";

const originalFetch = globalThis.fetch;
const originalLocalStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");

function jsonResponse(body: unknown, status = 200): Response {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
  } as Response;
}

function statusEnvelope(status: string) {
  return { success: true, content: { status } };
}

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear() {
      data.clear();
    },
    getItem(key: string) {
      return data.has(key) ? data.get(key)! : null;
    },
    key(i: number) {
      return [...data.keys()][i] ?? null;
    },
    removeItem(key: string) {
      data.delete(key);
    },
    setItem(key: string, value: string) {
      data.set(key, String(value));
    },
  };
}

function installLocalStorage() {
  const storage = memoryStorage();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: storage,
  });
  return storage;
}

function validSession(accessToken: string) {
  return {
    clientSessionId: "sess-9",
    userId: "user-1",
    status: "READY",
    token: {
      accessToken,
      refreshToken: "rt-stored",
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
    },
    user: { ready: true },
    wallet: {
      type: "internal",
      address: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
    },
  };
}

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalLocalStorage) {
    Object.defineProperty(globalThis, "localStorage", originalLocalStorage);
  } else {
    Reflect.deleteProperty(globalThis, "localStorage");
  }
});

describe("pollar session status helpers", () => {
  it("exports a 5-minute poll timeout matching the SDK", () => {
    assert.equal(POLL_TIMEOUT_MS, 5 * 60 * 1000);
  });

  it("recognizes READY, CONSUMED, and dead session codes", () => {
    assert.equal(isPollarSessionReady("READY"), true);
    assert.equal(isPollarSessionReady("GENERATING_WALLET"), false);
    assert.equal(isPollarSessionConsumed("CONSUMED"), true);
    assert.equal(isPollarSessionConsumed("PENDING"), false);
    assert.equal(isPollarSessionDead(404), true);
    assert.equal(isPollarSessionDead(410), true);
    assert.equal(isPollarSessionDead(200, "INVALID_CLIENT_SESSION_ID"), true);
    assert.equal(isPollarSessionDead(200, "EXPIRED_CLIENT_ID"), true);
    assert.equal(isPollarSessionDead(200, "SDK_UPGRADE_REQUIRED"), true);
    assert.equal(isPollarSessionDead(200, "OK"), false);
    assert.equal(isPollarSessionFailed("FAILED"), true);
    assert.equal(isPollarSessionFailed("ERROR"), true);
    assert.equal(isPollarSessionFailed("GENERATING_WALLET"), false);
  });
});

describe("waitForPollarSessionReady", () => {
  it("returns ready when the session is READY", async () => {
    globalThis.fetch = async () => jsonResponse(statusEnvelope("READY"));
    assert.equal(await waitForPollarSessionReady("sess-9", 1_000), "ready");
  });

  it("returns consumed when the session is CONSUMED", async () => {
    globalThis.fetch = async () => jsonResponse(statusEnvelope("CONSUMED"));
    assert.equal(await waitForPollarSessionReady("sess-9", 1_000), "consumed");
  });

  it("returns dead when wallet setup FAILED", async () => {
    globalThis.fetch = async () => jsonResponse(statusEnvelope("FAILED"));
    assert.equal(await waitForPollarSessionReady("sess-9", 1_000), "dead");
  });

  it("polls the v3 session status route", async () => {
    let polled = "";
    globalThis.fetch = async (input) => {
      polled = String(input);
      return jsonResponse(statusEnvelope("READY"));
    };
    await waitForPollarSessionReady("sess-9", 1_000);
    assert.match(polled, /\/v3\/auth\/session\/status\/sess-9\/poll$/);
  });

  it("keeps polling GENERATING_WALLET and PENDING until READY", async () => {
    const statuses = ["GENERATING_WALLET", "PENDING", "READY"];
    globalThis.fetch = async () => jsonResponse(statusEnvelope(statuses.shift() ?? "READY"));
    assert.equal(await waitForPollarSessionReady("sess-9", 5_000), "ready");
  });

  it("returns dead on 404 / expired client session", async () => {
    globalThis.fetch = async () =>
      jsonResponse({ success: false, code: "INVALID_CLIENT_SESSION_ID" }, 404);
    assert.equal(await waitForPollarSessionReady("sess-9", 1_000), "dead");
  });

  it("returns dead on EXPIRED_CLIENT_ID", async () => {
    globalThis.fetch = async () =>
      jsonResponse({ success: false, code: "EXPIRED_CLIENT_ID" }, 410);
    assert.equal(await waitForPollarSessionReady("sess-9", 1_000), "dead");
  });

  it("returns timeout when the deadline elapses", async () => {
    globalThis.fetch = async () => jsonResponse(statusEnvelope("GENERATING_WALLET"));
    assert.equal(await waitForPollarSessionReady("sess-9", 20), "timeout");
  });

  it("returns timeout when aborted", async () => {
    const controller = new AbortController();
    globalThis.fetch = async () => {
      controller.abort();
      return jsonResponse(statusEnvelope("PENDING"));
    };
    assert.equal(await waitForPollarSessionReady("sess-9", 5_000, controller.signal), "timeout");
  });
});

describe("completeHostedOAuthSession", () => {
  it("POSTs /v3/auth/login once READY and returns the access token", async () => {
    installLocalStorage();
    const calls: { url: string; method?: string }[] = [];
    globalThis.fetch = async (input, init) => {
      const url = String(input);
      calls.push({ url, method: init?.method });
      if (url.includes("/auth/session/status/")) {
        return jsonResponse(statusEnvelope("READY"));
      }
      if (url.endsWith("/v3/auth/login")) {
        return jsonResponse({
          success: true,
          content: validSession("at-login"),
        });
      }
      return jsonResponse({}, 404);
    };

    const token = await completeHostedOAuthSession({
      clientSessionId: "sess-9",
      apiKey: "pk_test",
    });
    assert.equal(token, "at-login");
    assert.equal(
      calls.some((c) => c.url.endsWith("/v3/auth/login") && c.method === "POST"),
      true,
    );
  });

  it("reads the stored pollar session when the hosted session is CONSUMED", async () => {
    const storage = installLocalStorage();
    const digest = async (data: Uint8Array) =>
      new Uint8Array(createHash("sha256").update(data).digest());
    const hash = await hashApiKeyPrefix("pk_test", digest);
    storage.setItem(pollarSessionStorageKey(hash), JSON.stringify(validSession("at-stored")));

    globalThis.fetch = async () => jsonResponse(statusEnvelope("CONSUMED"));

    const token = await completeHostedOAuthSession({
      clientSessionId: "sess-9",
      apiKey: "pk_test",
    });
    assert.equal(token, "at-stored");
  });

  it("falls back to the stored session when login fails after READY", async () => {
    const storage = installLocalStorage();
    const digest = async (data: Uint8Array) =>
      new Uint8Array(createHash("sha256").update(data).digest());
    const hash = await hashApiKeyPrefix("pk_test", digest);
    storage.setItem(pollarSessionStorageKey(hash), JSON.stringify(validSession("at-stored")));

    globalThis.fetch = async (input) => {
      const url = String(input);
      if (url.includes("/auth/session/status/")) {
        return jsonResponse(statusEnvelope("READY"));
      }
      return jsonResponse({ success: false }, 500);
    };

    const token = await completeHostedOAuthSession({
      clientSessionId: "sess-9",
      apiKey: "pk_test",
    });
    assert.equal(token, "at-stored");
  });
});
