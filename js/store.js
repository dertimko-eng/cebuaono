// Datenhaltung: Einstellungen, Lektionsfortschritt, SRS-Wörter, Ereignis-Log (alles in IndexedDB).
import { db, uuid } from "./db.js";
import { newWord, applyResult, todayKey, distribution, isDue, addDays } from "./srs.js";
import { computeStats } from "./stats.js";

export const DEFAULT_SETTINGS = {
  dailyGoal: 1, // Lektionen pro Tag (1–3)
  autoSync: true,
  trainerMode: "easy",
  trainerSize: 10,
  showedPersistHint: false,
};

export const XP = { correct: 10, near: 8, wrong: 0, lessonBonus: 20, trainerBonus: 10, storyBonus: 15 };

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
    this.dirty = !!(await db.kvGet("sync.dirty"));
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

  dirty: false, // lokale Änderungen seit dem letzten Upload?

  async addEvent(ev) {
    const e = { id: uuid(), t: Date.now(), ...ev };
    this.events.push(e);
    await db.put("events", e);
    await this.setDirty(true);
    return e;
  },

  async setDirty(v) {
    this.dirty = v;
    await db.kvSet("sync.dirty", v);
  },

  /**
   * Eine beantwortete Übung: SRS aktualisieren + Ereignis loggen.
   * @param {{lesson?:string, mode:string, exType:string, words:string[], correct:boolean, near?:boolean,
   *          dur:number, weight:number, firstTry?:boolean, due?:boolean}} a
   */
  async recordAnswer(a) {
    const today = todayKey();
    const touched = [];
    const blitz = a.mode === "blitz"; // Blitzrunde: nur loggen, keine SRS-Stufe und keine Einzel-XP (Punkte kommen über die Runde)
    for (const ceb of blitz ? [] : a.words || []) {
      const w = this.word(ceb);
      applyResult(w, a.correct, a.weight, a.near, today);
      touched.push(w);
    }
    if (touched.length) await db.bulkPut("words", touched);
    const xp = blitz ? 0 : a.correct ? (a.near ? XP.near : XP.correct) : XP.wrong;
    await this.addEvent({
      type: "answer", lesson: a.lesson || null, mode: a.mode, exType: a.exType, words: a.words || [],
      ...(a.phrase ? { phrase: a.phrase } : {}),
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
    // XP der einzelnen Antworten stecken schon in den answer-Events – hier nur der Bonus
    await this.addEvent({ type: "lesson_complete", lesson, dur, xp: XP.lessonBonus, sessionXp: xp + XP.lessonBonus, correct, total });
    await this.snapshotSrs(true);
    this.earnedFreeze = await this.maybeEarnFreeze();
    this.emit("lesson");
  },

  async completeTrainerRound({ mode, size, correct, near, wrong, dur, xp = XP.trainerBonus }) {
    await this.addEvent({ type: "trainer_round", mode, size, correct, near, wrong, dur, xp });
    await this.snapshotSrs(true);
    this.earnedFreeze = await this.maybeEarnFreeze();
    this.emit("trainer");
  },

  // Sätze-Runde (Themen-Sammlungen): hält den Streak wie eine Trainer-Runde
  async completePhraseRound({ collection, size, correct, wrong, dur }) {
    await this.addEvent({ type: "phrase_round", collection, size, correct, wrong, dur, xp: XP.trainerBonus });
    this.earnedFreeze = await this.maybeEarnFreeze();
    this.emit("phrases");
  },

  // Geschichten: gelesen-Liste in kv, Abschluss als Event (zählt XP)
  // Gelesene Geschichten und Blitz-Rekord kommen aus dem Event-Log – so sind sie im Sync/Export enthalten.
  async storiesDone() {
    const set = new Set((await db.kvGet("stories.done")) || []);
    for (const e of this.events) if (e.type === "story_complete" && e.story) set.add(e.story);
    return [...set];
  },
  async completeStory(id, correct, total) {
    const done = await this.storiesDone();
    if (done.includes(id)) return false; // XP nur beim ersten Abschluss
    await this.addEvent({ type: "story_complete", story: id, correct, total, xp: XP.storyBonus });
    this.emit("story");
    return true;
  },
  // ---------- Streak-Freezes ----------
  stats() { return computeStats({ events: this.events, words: this.wordList(), progress: [...this.progress.values()], content: this.content, settings: this.settings, srsHistory: this.srsHistory }); },
  async addFreeze(action, date, reason) {
    await this.addEvent({ type: "streak_freeze", action, date, reason, xp: 0 });
    this.emit("freeze");
  },
  // Beim Start: Geschenk-Freeze beim allerersten Mal, verpasste Tage automatisch überbrücken
  async maintainStreak() {
    if (!this.content) return { used: 0 };
    const hasAny = this.events.some((e) => e.type === "streak_freeze");
    if (!hasAny) await this.addFreeze("earn", todayKey(), "gift");
    const s = this.stats();
    let used = 0;
    if (s.freezeGap.length && s.freezeGap.length <= s.freezes) {
      for (const d of s.freezeGap) { await this.addFreeze("use", d, "auto"); used++; }
    }
    return { used, lost: s.freezeGap.length > s.freezes ? s.freezeGap.length : 0 };
  },
  // Nach Lektion/Trainer: alle 7 Streak-Tage einen Freeze (höchstens 2 auf Vorrat, einer pro Tag)
  async maybeEarnFreeze() {
    const s = this.stats();
    const today = todayKey();
    if (s.streak > 0 && s.streak % 7 === 0 && s.freezes < 2 && !this.events.some((e) => e.type === "streak_freeze" && e.action === "earn" && e.date === today && e.reason === "streak")) {
      await this.addFreeze("earn", today, "streak");
      return true;
    }
    return false;
  },

  async blitzBest() {
    let best = (await db.kvGet("blitz.best")) || 0;
    for (const e of this.events) if (e.type === "trainer_round" && e.mode === "blitz" && (e.xp || 0) > best) best = e.xp;
    return best;
  },
  async setBlitzBest(v) { await db.kvSet("blitz.best", v); },

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
    await db.kvDel("sync.dirty");
    for (const k of ["stories.done", "blitz.best", "review.lastShownWeek"]) await db.kvDel(k);
    this.dirty = false;
    this.progress = new Map(); this.words = new Map(); this.events = []; this.srsHistory = {};
    this.emit("reset");
  },
};
