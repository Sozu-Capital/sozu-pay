import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  clearPollarBrowserStorage,
  logoutPollarBrowserClient,
  pollarBrowserClientConfig,
} from "./browser-client.js";

describe("pollarBrowserClientConfig", () => {
  it("passes stellarNetwork from the publishable key, not a copied process.env object", () => {
    const mainnet = pollarBrowserClientConfig("pub_mainnet_live");
    assert.equal(mainnet.stellarNetwork, "mainnet");
    assert.equal(mainnet.loginTimeoutMs, 120_000);

    const testnet = pollarBrowserClientConfig("pub_testnet_dev");
    assert.equal(testnet.stellarNetwork, "testnet");
    assert.equal(testnet.loginTimeoutMs, 90_000);
  });
});

describe("Pollar logout keeps Turnkey device keys", () => {
  it("clears pollar: session keys and never deletes IndexedDB pollar-keys", () => {
    const deleted: string[] = [];
    const removed: string[] = [];
    const store: Record<string, string> = {
      "pollar:session": "x",
      other: "keep",
    };
    const localStorageMock = {
      get length() {
        return Object.keys(store).length;
      },
      key(index: number) {
        return Object.keys(store)[index] ?? null;
      },
      removeItem(key: string) {
        removed.push(key);
        delete store[key];
      },
    };
    const globalAny = globalThis as Record<string, unknown>;
    const prev = {
      window: globalAny.window,
      localStorage: globalAny.localStorage,
      indexedDB: globalAny.indexedDB,
    };
    globalAny.window = globalThis;
    globalAny.localStorage = localStorageMock;
    globalAny.indexedDB = {
      deleteDatabase: (name: string) => {
        deleted.push(name);
      },
    };
    try {
      clearPollarBrowserStorage();
      assert.deepEqual(removed, ["pollar:session"]);
      assert.equal(store.other, "keep");
      assert.deepEqual(deleted, []);
    } finally {
      globalAny.window = prev.window;
      globalAny.localStorage = prev.localStorage;
      globalAny.indexedDB = prev.indexedDB;
    }
  });

  it("logoutPollarBrowserClient still does not wipe pollar-keys", async () => {
    const deleted: string[] = [];
    const globalAny = globalThis as Record<string, unknown>;
    const prev = {
      window: globalAny.window,
      localStorage: globalAny.localStorage,
      indexedDB: globalAny.indexedDB,
    };
    globalAny.window = globalThis;
    globalAny.localStorage = {
      length: 0,
      key: () => null,
      removeItem: () => undefined,
    };
    globalAny.indexedDB = {
      deleteDatabase: (name: string) => {
        deleted.push(name);
      },
    };
    try {
      await logoutPollarBrowserClient();
      assert.deepEqual(deleted, []);
    } finally {
      globalAny.window = prev.window;
      globalAny.localStorage = prev.localStorage;
      globalAny.indexedDB = prev.indexedDB;
    }
  });
});
