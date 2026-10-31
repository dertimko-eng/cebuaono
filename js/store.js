// Datenhaltung: Einstellungen, Lektionsfortschritt, SRS-Wörter, Ereignis-Log (alles in IndexedDB).
import { db, uuid } from "./db.js";
import { newWord, applyResult, todayKey, distribution, isDue } from "./srs.js";

export const DEFAULT_SETTINGS = {
  dailyGoal: 1, // Lektionen pro Tag (1–3)
  autoSync: true,
  trainerMode: "easy",
  trainerSize: 10,
  showedPersistHint: false,
};

export const XP = { correct: 10, near: 8, wrong: 0, lessonBonus: 20, trainerBonus: 10 };

export const store = {
  content: null,
  settings: { ...DEFAULT_SETTINGS },
  progress: new Map(),
  words: new Map(),
  events: [],
  srsHistory: {},
  listeners: new Set(),

  async init(content) {
    this.content = content;
    const s = await db.kvGet("settings");
    this.settings = { ...DEFAULT_SETTINGS, ...(s || {}) };
    this.progress = new Map((await db.getAll("progress")).map((p) => [p.id, p]));
    this.words = new Map((await db.getAll("words")).map((w) => [w.ceb, w]));
    this.events = (await db.getAll("events")).sort((a, b) => a.t - b.t);
    this.srsHistory = (await db.kvGet("srsHistory")) || {};
    await this.snapshotSrs();
  },

  onChange(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); },
  emit(what) { for (const fn of this.listeners) try { fn(what); } catch (e) { console.error(e); } },

  async setSetting(key, value) {
    this.settings[key] = value;
    await db.kvSet("settings", this.settings);
    this.emit("settings");
  },

  completedSet() {
    return new Set([...this.progress.values()].filter((p) => p.completed).map((p) => p.id));
  },

  word(ceb) {
    let w = this.words.get(ceb);
    if (!w) { w = newWord(ceb); this.words.set(ceb, w); }
    return w;
  },

  wordList() { return [...this.words.values()]; },

  dueWords(today = todayKey()) {
    return this.wordList().filter((w) => isDue(w, today));
  },

  async addEvent(ev) {
    const e = { id: uuid(), t: Date.now(), ...ev };
    this.events.push(e);
    await db.put("events", e);
    return e;
  },

  /**
   * Eine beantwortete Übung: SRS aktualisieren + Ereignis loggen.
   * @param {{lesson?:string, mode:string, exType:string, words:string[], correct:boolean, near?:boolean,
   *          dur:number, weight:number, firstTry?:boolean, due?:boolean}} a
   */
  async recordAnswer(a) {
    const today = todayKey();
    const touched = [];
    for (const ceb of a.words || []) {
      const w = this.word(ceb);
      applyResult(w, a.correct, a.weight, a.near, today);
      touched.push(w);
    }
    if (touched.length) await db.bulkPut("words", touched);
    const xp = a.correct ? (a.near ? XP.near : XP.correct) : XP.wrong;
    await this.addEvent({
      type: "answer", lesson: a.lesson || null, mode: a.mode, exType: a.exType, words: a.words || [],
      correct: !!a.correct, near: !!a.near, dur: a.dur || 0, firstTry: a.firstTry !== false, due: !!a.due, xp,
    });
    this.emit("answer");
    return xp;
  },

  async completeLesson({ lesson, dur, xp, correct, total }) {
    const p = this.progress.get(lesson) || { id: lesson, attempts: 0, bestAccuracy: 0 };
    p.completed = true;
    p.completedAt = p.completedAt || Date.now();
    p.attempts = (p.attempts || 0) + 1;
    p.lastAccuracy = total ? Math.round((correct / total) * 100) : 0;
    p.bestAccuracy = Math.max(p.bestAccuracy || 0, p.lastAccuracy);
    p.updatedAt = Date.now();
    this.progress.set(lesson, p);
    await db.put("progress", p);
    await this.addEvent({ type: "lesson_complete", lesson, dur, xp: xp + XP.lessonBonus, correct, total });
    await this.snapshotSrs(true);
    this.emit("lesson");
  },

  async completeTrainerRound({ mode, size, correct, near, wrong, dur }) {
    await this.addEvent({ type: "trainer_round", mode, size, correct, near, wrong, dur, xp: XP.trainerBonus });
    await this.snapshotSrs(true);
    this.emit("trainer");
  },

  // Tagesstand der SRS-Stufen speichern (für den 30-Tage-Verlauf)
  async snapshotSrs(force = false) {
    const k = todayKey();
    if (!force && this.srsHistory[k]) return;
    this.srsHistory[k] = distribution(this.wordList());
    // nur die letzten 400 Tage behalten
    const keys = Object.keys(this.srsHistory).sort();
    for (const old of keys.slice(0, Math.max(0, keys.length - 400))) delete this.srsHistory[old];
    await db.kvSet("srsHistory", this.srsHistory);
  },

  // ---------- Export / Import / Sync-Payloads ----------
  exportProgress() {
    return {
      app: "cebuano", version: 1, exportedAt: Date.now(), device: navigator.userAgent.slice(0, 60),
      settings: { dailyGoal: this.settings.dailyGoal, trainerMode: this.settings.trainerMode, trainerSize: this.settings.trainerSize },
      progress: [...this.progress.values()],
      words: this.wordList(),
      srsHistory: this.srsHistory,
    };
  },
  exportEvents() {
    return { app: "cebuano", version: 1, exportedAt: Date.now(), events: this.events };
  },
  exportAll() {
    return { ...this.exportProgress(), events: this.events };
  },

  /**
   * Zusammenführen: neuere Einträge gewinnen (updatedAt), Ereignisse werden vereinigt (nie überschrieben).
   * Liefert true, wenn sich lokal etwas geändert hat.
   */
  async mergeIn(remote) {
    if (!remote || remote.app !== "cebuano") throw new Error("Unbekanntes Dateiformat.");
    let changed = false;
    const putP = [], putW = [], putE = [];
    for (const rp of remote.progress || []) {
      const lp = this.progress.get(rp.id);
      if (!lp || (rp.updatedAt || 0) > (lp.updatedAt || 0) || (rp.completed && !lp.completed)) {
        const merged = { ...(lp || {}), ...rp, completed: !!(rp.completed || lp?.completed), bestAccuracy: Math.max(rp.bestAccuracy || 0, lp?.bestAccuracy || 0) };
        this.progress.set(rp.id, merged); putP.push(merged); changed = true;
      }
    }
    for (const rw of remote.words || []) {
      const lw = this.words.get(rw.ceb);
      if (!lw || (rw.updatedAt || 0) > (lw.updatedAt || 0)) {
        const merged = { ...(lw || {}), ...rw, correct: Math.max(rw.correct || 0, lw?.correct || 0), wrong: Math.max(rw.wrong || 0, lw?.wrong || 0) };
        this.words.set(rw.ceb, merged); putW.push(merged); changed = true;
      }
    }
    const have = new Set(this.events.map((e) => e.id));
    for (const re of remote.events || []) {
      if (re && re.id && !have.has(re.id)) { this.events.push(re); putE.push(re); have.add(re.id); changed = true; }
    }
    if (putE.length) this.events.sort((a, b) => a.t - b.t);
    for (const [k, v] of Object.entries(remote.srsHistory || {})) {
      if (!this.srsHistory[k]) { this.srsHistory[k] = v; changed = true; }
    }
    if (remote.settings && remote.settings.dailyGoal && !this.settings._localSettings) {
      // Einstellungen: nur übernehmen, wenn lokal noch Standard
    }
    if (putP.length) await db.bulkPut("progress", putP);
    if (putW.length) await db.bulkPut("words", putW);
    if (putE.length) await db.bulkPut("events", putE);
    if (changed) await db.kvSet("srsHistory", this.srsHistory);
    if (changed) this.emit("merge");
    return changed;
  },

  async resetAll() {
    for (const s of ["progress", "words", "events"]) await db.clear(s);
    await db.kvDel("srsHistory");
    await db.kvDel("lesson.inprogress");
    await db.kvDel("trainer.inprogress");
    this.progress = new Map(); this.words = new Map(); this.events = []; this.srsHistory = {};
    this.emit("reset");
  },
};
