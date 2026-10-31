// IndexedDB-Wrapper. Stores:
//   kv        {key, value}                       Einstellungen, Zwischenstände, Sync-Metadaten
//   progress  {id, completed, completedAt, attempts, bestAccuracy, updatedAt}   pro Lektion
//   words     {ceb, stage, points, due, correct, wrong, near, lastSeen, updatedAt}  SRS pro Wort
//   events    {id, t, type, ...}                 Ereignis-Log (append-only)
const DB_NAME = "cebuano-app";
const DB_VERSION = 1;

let dbPromise = null;

function open() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("kv")) db.createObjectStore("kv", { keyPath: "key" });
      if (!db.objectStoreNames.contains("progress")) db.createObjectStore("progress", { keyPath: "id" });
      if (!db.objectStoreNames.contains("words")) db.createObjectStore("words", { keyPath: "ceb" });
      if (!db.objectStoreNames.contains("events")) {
        const s = db.createObjectStore("events", { keyPath: "id" });
        s.createIndex("t", "t");
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx(store, mode, fn) {
  return open().then(
    (db) =>
      new Promise((resolve, reject) => {
        const t = db.transaction(store, mode);
        const s = t.objectStore(store);
        let result;
        try {
          result = fn(s);
        } catch (e) {
          reject(e);
          return;
        }
        t.oncomplete = () => resolve(result && "result" in result ? result.result : result);
        t.onerror = () => reject(t.error);
        t.onabort = () => reject(t.error);
      }),
  );
}

export const db = {
  get: (store, key) => tx(store, "readonly", (s) => s.get(key)),
  getAll: (store) => tx(store, "readonly", (s) => s.getAll()),
  put: (store, value) => tx(store, "readwrite", (s) => s.put(value)),
  bulkPut: (store, values) => tx(store, "readwrite", (s) => { for (const v of values) s.put(v); }),
  delete: (store, key) => tx(store, "readwrite", (s) => s.delete(key)),
  clear: (store) => tx(store, "readwrite", (s) => s.clear()),
  count: (store) => tx(store, "readonly", (s) => s.count()),
  // kv-Komfort
  async kvGet(key, fallback = null) {
    const r = await this.get("kv", key);
    return r ? r.value : fallback;
  },
  kvSet(key, value) {
    return this.put("kv", { key, value });
  },
  kvDel(key) {
    return this.delete("kv", key);
  },
};

export function uuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  const a = crypto.getRandomValues(new Uint8Array(16));
  a[6] = (a[6] & 0x0f) | 0x40;
  a[8] = (a[8] & 0x3f) | 0x80;
  const h = [...a].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export async function requestPersistentStorage() {
  try {
    if (navigator.storage && navigator.storage.persist) return await navigator.storage.persist();
  } catch (_) {}
  return false;
}
