"use client";

import { PollarClient } from "@pollar/core";

const POLLAR_STORAGE_PREFIX = "pollar:";
const POLLAR_KEYS_DB = "pollar-keys";

let client: PollarClient | null = null;
let clientApiKey: string | null = null;

export function getPollarPublishableKey(): string {
  return (process.env.NEXT_PUBLIC_POLLAR_PUBLISHABLE_KEY ?? "").trim();
}

export function isPollarFakeAuth(): boolean {
  return process.env.NEXT_PUBLIC_POLLAR_FAKE_AUTH === "true" || !getPollarPublishableKey();
}

/** One client per publishable key. Pollar warns (and can TDZ) if we construct/destroy per mount. */
export function getPollarBrowserClient(): PollarClient | null {
  if (typeof window === "undefined") return null;
  const apiKey = getPollarPublishableKey();
  if (!apiKey) return null;
  if (client && clientApiKey === apiKey) return client;
  client?.destroy();
  client = new PollarClient({ apiKey });
  clientApiKey = apiKey;
  return client;
}

export function clearPollarBrowserStorage(): void {
  if (typeof window === "undefined") return;
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(POLLAR_STORAGE_PREFIX)) keys.push(key);
    }
    for (const key of keys) localStorage.removeItem(key);
  } catch {
    // private mode
  }
  try {
    indexedDB.deleteDatabase(POLLAR_KEYS_DB);
  } catch {
    // ignore
  }
}

/** Revoke Pollar session so the next Google login is a clean OAuth, not a restore. */
export async function logoutPollarBrowserClient(): Promise<void> {
  try {
    if (client) {
      await client.ready();
      await client.logout();
      client.destroy();
    }
  } catch {
    // still wipe local state
  }
  client = null;
  clientApiKey = null;
  clearPollarBrowserStorage();
}
