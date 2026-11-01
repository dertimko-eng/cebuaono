// Dropbox-Sync: progress.json + events.json herunterladen, zusammenführen, hochladen.
// Außerdem manueller Export/Import als JSON-Datei.
import { db } from "./db.js";
import { dropbox } from "./dropbox.js";
import { store } from "./store.js";
import { CONFIG } from "./config.js";

export const sync = {
  running: false,
  lastSync: null,
  lastError: null,
  listeners: new Set(),

  async init() {
    this.lastSync = await db.kvGet("sync.last");
    this.lastError = await db.kvGet("sync.error");
  },
  onChange(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); },
  emit() { for (const fn of this.listeners) try { fn(this); } catch (_) {} },

  async canSync() {
    return dropbox.isConfigured() && (await dropbox.isConnected());
  },

  /** Vollständiger Sync-Lauf. Gibt {changed, error} zurück. */
  async run(reason = "manual") {
    if (this.running) return { changed: false, skipped: true };
    if (!(await this.canSync())) return { changed: false, skipped: true };
    if (!navigator.onLine) { this.lastError = "Offline"; this.emit(); return { changed: false, error: "offline" }; }
    this.running = true;
    this.emit();
    try {
      const [pText, eText] = await Promise.all([
        dropbox.download(CONFIG.DROPBOX_PROGRESS_FILE),
        dropbox.download(CONFIG.DROPBOX_EVENTS_FILE),
      ]);
      let changed = false;
      if (pText) {
        const remote = JSON.parse(pText);
        if (eText) {
          try { remote.events = JSON.parse(eText).events || []; } catch (_) { remote.events = []; }
        }
        changed = await store.mergeIn(remote);
      }
      // Nach dem Merge hochladen (jetzt enthält der lokale Stand alles) – nur wenn nötig.
      // dirty wird VOR dem Serialisieren zurückgesetzt: Änderungen während des Uploads markieren erneut.
      if (store.dirty || changed || !pText || !eText) {
        await store.setDirty(false);
        try {
          await dropbox.upload(CONFIG.DROPBOX_PROGRESS_FILE, JSON.stringify(store.exportProgress()));
          await dropbox.upload(CONFIG.DROPBOX_EVENTS_FILE, JSON.stringify(store.exportEvents()));
        } catch (e) {
          await store.setDirty(true);
          throw e;
        }
      }
      this.lastSync = Date.now();
      this.lastError = null;
      await db.kvSet("sync.last", this.lastSync);
      await db.kvDel("sync.error");
      return { changed };
    } catch (e) {
      console.error("Sync-Fehler", e);
      this.lastError = e.message || String(e);
      await db.kvSet("sync.error", this.lastError);
      return { changed: false, error: this.lastError };
    } finally {
      this.running = false;
      this.emit();
    }
  },

  // ---------- Datei-Export / -Import ----------
  async exportToFile() {
    const data = JSON.stringify(store.exportAll(), null, 1);
    const blob = new Blob([data], { type: "application/json" });
    const d = new Date();
    const name = `cebuano-fortschritt-${d.toISOString().slice(0, 10)}.json`;
    // iOS-Home-Bildschirm-App: Teilen-Dialog (Dateien, AirDrop, Mail) statt Download
    try {
      const file = new File([blob], name, { type: "application/json" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: "Cebuano-Fortschritt" });
        return;
      }
    } catch (e) {
      if (e && e.name === "AbortError") return;
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.append(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
  },

  async importFromFile(file) {
    const text = await file.text();
    const obj = JSON.parse(text);
    return store.mergeIn(obj);
  },
};
