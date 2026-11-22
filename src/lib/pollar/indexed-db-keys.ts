"use client";

import { POLLAR_KEYS_DB } from "@/lib/pollar/browser-client";
import { extractCompressedPublicKeys } from "@/lib/pollar/device-keys";

export type PollarIndexedDbStoreDump = {
  name: string;
  recordCount: number;
  publicKeys: string[];
};

export type PollarIndexedDbDump = {
  origin: string;
  databases: {
    name: string;
    version: number | null;
    stores: PollarIndexedDbStoreDump[];
  }[];
  publicKeys: string[];
};

async function listDatabaseNames(): Promise<{ name: string; version: number | null }[]> {
  const listed: { name: string; version: number | null }[] = [];
  try {
    const api = indexedDB as IDBFactory & {
      databases?: () => Promise<Array<{ name?: string; version?: number }>>;
    };
    if (typeof api.databases === "function") {
      const rows = await api.databases();
      for (const row of rows) {
        if (row.name) listed.push({ name: row.name, version: row.version ?? null });
      }
    }
  } catch {
    // Firefox / private mode
  }
  if (!listed.some((row) => row.name === POLLAR_KEYS_DB)) {
    listed.push({ name: POLLAR_KEYS_DB, version: null });
  }
  return listed;
}

function openExistingDatabase(name: string): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    let created = false;
    const request = indexedDB.open(name);
    request.onupgradeneeded = () => {
      created = true;
      request.transaction?.abort();
    };
    request.onsuccess = () => {
      const db = request.result;
      if (created) {
        db.close();
        resolve(null);
        return;
      }
      resolve(db);
    };
    request.onerror = () => resolve(null);
  });
}

function readStore(db: IDBDatabase, storeName: string): Promise<unknown[]> {
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(storeName, "readonly");
      const store = tx.objectStore(storeName);
      const request = store.getAll();
      request.onsuccess = () => resolve(Array.isArray(request.result) ? request.result : []);
      request.onerror = () => resolve([]);
    } catch {
      resolve([]);
    }
  });
}

export async function dumpPollarIndexedDb(): Promise<PollarIndexedDbDump> {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const databases: PollarIndexedDbDump["databases"] = [];
  const publicKeys = new Set<string>();

  for (const listed of await listDatabaseNames()) {
    if (!/pollar/i.test(listed.name) && listed.name !== POLLAR_KEYS_DB) continue;
    const db = await openExistingDatabase(listed.name);
    if (!db) continue;
    try {
      const stores: PollarIndexedDbStoreDump[] = [];
      for (const storeName of Array.from(db.objectStoreNames)) {
        const records = await readStore(db, storeName);
        const keys = extractCompressedPublicKeys(records);
        for (const key of keys) publicKeys.add(key);
        stores.push({ name: storeName, recordCount: records.length, publicKeys: keys });
      }
      databases.push({
        name: db.name,
        version: db.version,
        stores,
      });
    } finally {
      db.close();
    }
  }

  return { origin, databases, publicKeys: [...publicKeys] };
}
