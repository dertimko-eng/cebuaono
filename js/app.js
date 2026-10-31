// Einstieg: Router, Startbildschirm, Lernpfad, Wörterliste, Überraschungssätze, Einstellungen.
import { h, esc, toast, sheet, confirmSheet, fmtTime, isStandalone, isIOS, replace } from "./ui.js";
import { loadContent } from "./content.js";
import { store } from "./store.js";
import { sync } from "./sync.js";
import { dropbox } from "./dropbox.js";
import { db, requestPersistentStorage } from "./db.js";
import { mountLesson, hasLessonInProgress, discardLessonInProgress } from "./lesson.js";
import { mountTrainer } from "./trainer.js";
import { renderProgress, weeklyReviewText, getStats } from "./progress.js";
import { categoryOf, todayKey } from "./srs.js";
import { weekStart } from "./stats.js";
import { CONFIG } from "./config.js";

const main = document.getElementById("main");
const tabs = document.getElementById("tabs");
let content = null;
let current = null; // aktive Ansicht (für pause etc.)

const navigate = (hash) => { location.hash = hash; };

// ---------- Start ----------
async function boot() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch((e) => console.warn("SW", e));
  }
  try {
    content = await loadContent();
  } catch (e) {
    replace(main, h("div", { class: "card" }, h("h2", {}, "Inhalte konnten nicht geladen werden"), h("p", {}, String(e.message))));
    return;
  }
  await store.init(content);
  await sync.init();

  // OAuth-Redirect von Dropbox?
  try {
    if (await dropbox.handleRedirect()) {
      toast("Mit Dropbox verbunden.");
      location.hash = "#settings";
      sync.run("connect").then(() => render());
    }
  } catch (e) {
    toast(e.message, 5000);
  }

  // Automatischer Sync beim Start
  if (store.settings.autoSync && (await sync.canSync())) {
    sync.run("start").then((r) => { if (r.changed) { toast("Fortschritt von Dropbox übernommen."); render(); } });
  }
  document.addEventListener("lesson-complete", () => { if (store.settings.autoSync) sync.run("lesson"); });
  document.addEventListener("trainer-complete", () => { if (store.settings.autoSync) sync.run("trainer"); });
  sync.onChange(() => document.querySelectorAll("[data-sync-status]").forEach((el) => (el.textContent = syncStatusText())));

  window.addEventListener("hashchange", render);
  if (!location.hash) location.hash = "#home";
  render();
  maybeWeeklyReview();
  requestPersistentStorage();
}

function syncStatusText() {
  if (sync.running) return "Synchronisiere …";
  if (sync.lastError) return `Fehler: ${sync.lastError}`;
  return sync.lastSync ? `Zuletzt synchronisiert: ${fmtTime(sync.lastSync)}` : "Noch nie synchronisiert";
}

async function maybeWeeklyReview() {
  const today = todayKey();
  const d = new Date();
  if (d.getDay() !== 1) return; // Montag
  const wk = weekStart(today);
  const shown = await db.kvGet("review.lastShownWeek");
  if (shown === wk) return;
  const lines = weeklyReviewText(content);
  await db.kvSet("review.lastShownWeek", wk);
  if (!lines) return;
  const c = h("div", {}, h("h2", { style: { marginTop: 0 } }, "Dein Wochenrückblick"), lines.map((l) => h("p", {}, l)),
    h("button", { class: "btn-primary btn-block mt", onclick: () => s.close() }, "Auf in die neue Woche"));
  const s = sheet(c);
}

// ---------- Router ----------
async function render() {
  const hash = location.hash || "#home";
  const [route, ...rest] = hash.slice(1).split("/");
  const param = rest.join("/");
  document.body.classList.remove("lesson-mode");
  main.classList.remove("nobounce");
  document.querySelectorAll(".feedback, .overlay").forEach((e) => e.remove());
  tabs.querySelectorAll("a").forEach((a) => a.classList.toggle("active", a.getAttribute("href") === "#" + route || (route === "more" && a.getAttribute("href") === "#more") || (["words", "surprises", "settings"].includes(route) && a.getAttribute("href") === "#more")));
  switch (route) {
    case "home": return renderHome();
    case "path": return renderPath();
    case "lesson": return mountLesson(main, param, { content, onExit: () => navigate("#path") });
    case "trainer": {
      let preset = null;
      if (param.startsWith("preset")) {
        const q = new URLSearchParams(param.split("?")[1] || "");
        preset = { words: (q.get("words") || "").split("|").filter(Boolean), mode: q.get("mode") || null };
      } else if (param === "review") {
        const due = store.dueWords().map((w) => w.ceb);
        preset = { words: due, mode: store.settings.trainerMode };
      }
      return mountTrainer(main, { content, preset, onExit: () => navigate("#home") });
    }
    case "progress": return renderProgress(main, { content, navigate });
    case "words": return renderWords();
    case "surprises": return renderSurprises();
    case "settings": return renderSettings();
    case "more": return renderMore();
    default: return renderHome();
  }
}

// ---------- Start-Bildschirm ----------
async function renderHome() {
  const s = getStats(content);
  const completed = store.completedSet();
  const inProgress = await hasLessonInProgress();
  const nextId = inProgress?.lessonId || content.nextLessonId(completed);
  const next = nextId ? content.lesson(nextId) : null;
  const goalDots = h("div", { class: "goal-dots" }, Array.from({ length: s.dailyGoal }, (_, i) => h("i", { class: i < s.lessonsToday ? "on" : "" })));
  replace(main, 
    h("h1", {}, "Maayong adlaw!"),
    h("div", { class: "stat-grid" },
      h("div", { class: "stat" }, h("b", {}, s.streak + " 🔥"), h("span", {}, "Tage Streak")),
      h("div", { class: "stat" }, h("b", {}, `${s.lessonsToday}/${s.dailyGoal}`), h("span", {}, "Tagesziel")),
      h("div", { class: "stat" }, h("b", {}, s.xpToday), h("span", {}, "XP heute")),
    ),
    h("div", { class: "card accent mt" },
      next
        ? [h("div", { class: "muted small" }, inProgress ? "Angefangene Lektion" : `Unit ${next.unit} · Lektion ${next.posInUnit}`),
           h("h2", { style: { margin: "4px 0 12px" } }, next.title),
           h("div", { class: "row" }, goalDots, h("span", { class: "small" }, s.lessonsToday >= s.dailyGoal ? "Tagesziel erreicht!" : `noch ${s.dailyGoal - s.lessonsToday} bis zum Tagesziel`)),
           h("button", { class: "btn-block btn-big mt", style: { background: "var(--card)", color: "var(--text)" }, onclick: () => navigate("#lesson/" + next.id) }, inProgress ? "Weitermachen" : "Weiter")]
        : [h("h2", {}, "Alle 72 Lektionen geschafft!"), h("p", {}, "Halte deinen Wortschatz mit dem Trainer frisch.")],
    ),
    h("div", { class: "card" },
      h("div", { class: "row spread" }, h("div", {}, h("b", {}, s.dueCount), " Wörter fällig"), h("button", { class: "btn-small " + (s.dueCount ? "btn-primary" : ""), disabled: !s.dueCount, onclick: () => navigate("#trainer/review") }, "Wiederholen")),
    ),
    h("div", { class: "card" },
      h("div", { class: "row spread" }, h("span", {}, "Gelernte Wörter"), h("b", {}, `${s.learnedWords} / ${s.totalWords}`)),
      h("div", { class: "row spread" }, h("span", {}, "Lektionen"), h("b", {}, `${s.completedLessons} / ${s.totalLessons}`)),
      h("div", { class: "row spread" }, h("span", {}, "Niveau"), h("b", {}, s.level)),
    ),
    h("p", { class: "small muted center", "data-sync-status": "" }, (await sync.canSync()) ? syncStatusText() : "Dropbox nicht verbunden – Daten nur lokal"),
  );
  main.scrollTop = 0;
}

// ---------- Lernpfad ----------
async function renderPath() {
  const completed = store.completedSet();
  const inProgress = await hasLessonInProgress();
  const nextId = content.nextLessonId(completed);
  const els = [h("h1", {}, "Lernpfad")];
  if (!content.units.length) els.push(h("p", {}, "Keine Units gefunden."));
  for (const u of content.units) {
    const doneN = u.lessons.filter((l) => completed.has(l.id)).length;
    els.push(h("div", { class: "unit-head" }, h("h2", { style: { margin: 0 } }, `Unit ${u.unit}: ${u.title}`), h("span", { class: "lvl" }, u.level)));
    els.push(h("p", { class: "small muted", style: { margin: "0 0 8px" } }, `${doneN}/${u.lessons.length} Lektionen`));
    const path = h("div", { class: "path" });
    u.lessons.forEach((l, i) => {
      const isDone = completed.has(l.id);
      const isNext = l.id === nextId;
      const unlocked = isDone || content.isUnlocked(l.id, completed);
      const p = store.progress.get(l.id);
      const node = h("a", { class: "node " + (isDone ? "done" : isNext ? "next" : unlocked ? "" : "locked"), href: unlocked ? "#lesson/" + l.id : null, onclick: unlocked ? null : (e) => { e.preventDefault(); toast("Erst die vorherige Lektion abschließen."); } },
        h("div", { class: "num" }, isDone ? "✓" : unlocked ? String(i + 1) : "🔒"),
        h("div", { class: "t" }, h("b", {}, l.title), h("span", {}, isDone ? `Beste Quote ${p?.bestAccuracy ?? 0} % · nochmal üben` : inProgress?.lessonId === l.id ? "angefangen – weitermachen" : `${l.vocab.length} Wörter · ${l.exercises.filter((e) => e.type !== "grammar_note").length} Übungen`)),
      );
      path.append(node);
    });
    els.push(path);
  }
  replace(main, ...els);
  const nextEl = main.querySelector(".node.next");
  if (nextEl) nextEl.scrollIntoView({ block: "center" });
}

// ---------- Wörterliste ----------
function renderWords() {
  const input = h("input", { type: "search", placeholder: "Suchen (Cebuano oder Deutsch)", autocorrect: "off", autocapitalize: "off", spellcheck: "false" });
  let filter = "alle";
  const list = h("div", { class: "card vocab-list" });
  const completed = store.completedSet();
  const seg = h("div", { class: "seg mb" }, ["alle", "neu", "lernend", "gefestigt", "gemeistert"].map((f) => h("button", { class: f === filter ? "on" : "", onclick: (e) => { filter = f; seg.querySelectorAll("button").forEach((b) => b.classList.toggle("on", b === e.target)); update(); } }, f)));
  function update() {
    const q = input.value.trim().toLowerCase();
    const rows = content.glossary.entries.filter((e) => {
      const w = store.words.get(e.ceb);
      const learned = completed.has(e.lesson) || (w && w.stage > 0);
      if (!learned) return false;
      const cat = categoryOf(w);
      if (filter !== "alle" && cat !== filter) return false;
      return !q || e.ceb.toLowerCase().includes(q) || e.de.toLowerCase().includes(q);
    });
    replace(list, rows.length ? rows.map((e) => {
      const w = store.words.get(e.ceb);
      const cat = categoryOf(w);
      return h("div", { class: "v" }, h("div", {}, h("b", {}, e.ceb), h("span", { class: "note" }, e.de, e.note ? ` – ${e.note}` : "")), h("div", { style: { textAlign: "right" } }, h("span", { class: "badge " + cat }, cat), w?.due && w.stage > 0 ? h("div", { class: "small muted" }, "fällig " + w.due.slice(8, 10) + "." + w.due.slice(5, 7) + ".") : null));
    }) : h("p", { class: "muted" }, "Keine Wörter – schließe zuerst eine Lektion ab."));
  }
  input.addEventListener("input", update);
  replace(main, h("h1", {}, "Wörter"), h("div", { class: "search" }, input), seg, list);
  update();
}

// ---------- Für meine Frau ----------
function renderSurprises() {
  const completed = store.completedSet();
  const all = content.surprises();
  const open = all.filter((s) => completed.has(s.lessonId));
  const locked = all.length - open.length;
  replace(main, 
    h("h1", {}, "Für meine Frau"),
    h("p", { class: "muted" }, "Alle Überraschungssätze aus abgeschlossenen Lektionen."),
    open.length ? open.map((s) => h("div", { class: "surprise mb" }, h("div", { class: "ceb" }, s.ceb), h("div", { class: "de" }, s.de), h("div", { class: "when" }, `Wann: ${s.when} · Unit ${s.unit}`))) : h("p", {}, "Noch keine – die erste Lektion wartet."),
    locked ? h("p", { class: "small muted center" }, `${locked} weitere Sätze warten in den nächsten Lektionen.`) : null,
  );
  main.scrollTop = 0;
}

// ---------- Mehr ----------
function renderMore() {
  replace(main, 
    h("h1", {}, "Mehr"),
    h("div", { class: "card list" },
      h("a", { href: "#words" }, "📚 Wörterliste"),
      h("a", { href: "#surprises" }, "💛 Für meine Frau"),
      h("a", { href: "#settings" }, "⚙️ Einstellungen & Dropbox"),
    ),
  );
}

// ---------- Einstellungen ----------
async function renderSettings() {
  const connected = await sync.canSync();
  const standalone = isStandalone();
  const goalSeg = h("div", { class: "seg" }, [1, 2, 3].map((n) => h("button", { class: store.settings.dailyGoal === n ? "on" : "", onclick: async (e) => { await store.setSetting("dailyGoal", n); goalSeg.querySelectorAll("button").forEach((b) => b.classList.toggle("on", b === e.target)); } }, `${n} Lektion${n > 1 ? "en" : ""}`)));
  const autoBox = h("input", { type: "checkbox", style: { width: "auto" }, checked: store.settings.autoSync, onchange: (e) => store.setSetting("autoSync", e.target.checked) });
  const codeInput = h("input", { type: "text", placeholder: "Code von Dropbox einfügen", autocorrect: "off", autocapitalize: "off", spellcheck: "false" });
  const connectBtn = async (manual) => {
    try {
      if (manual) {
        const url = await dropbox.startAuth({ manual: true });
        window.open(url, "_blank");
        manualBox.classList.remove("hidden");
      } else {
        await dropbox.startAuth({ manual: false });
      }
    } catch (e) { toast(e.message, 5000); }
  };
  const manualBox = h("div", { class: standalone ? "mt" : "mt hidden" },
    h("p", { class: "small muted" }, "Dropbox zeigt dir nach dem Erlauben einen Code an. Kopiere ihn und füge ihn hier ein:"),
    codeInput,
    h("button", { class: "btn-block mt", onclick: async () => { try { await dropbox.finishManualCode(codeInput.value); toast("Mit Dropbox verbunden."); await sync.run("connect"); renderSettings(); } catch (e) { toast(e.message, 5000); } } }, "Code bestätigen"),
  );
  const fileInput = h("input", { type: "file", accept: "application/json,.json", class: "hidden", onchange: async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try { const changed = await sync.importFromFile(f); toast(changed ? "Import übernommen." : "Nichts Neues in der Datei."); renderSettings(); } catch (err) { toast("Import fehlgeschlagen: " + err.message, 5000); }
  } });
  const dropboxCard = h("div", { class: "card" },
    h("h3", { style: { marginTop: 0 } }, "Dropbox-Sync"),
    !dropbox.isConfigured()
      ? h("p", { class: "muted" }, "Kein App-Key eingetragen. Trage deinen Dropbox-App-Key in js/config.js ein (siehe README), dann erscheint hier der Verbinden-Button.")
      : connected
        ? [h("p", {}, "✅ Verbunden"), h("p", { class: "small muted", "data-sync-status": "" }, syncStatusText()),
           h("div", { class: "row mt" }, h("button", { class: "grow btn-primary", onclick: async () => { const r = await sync.run("manual"); toast(r.error ? "Sync-Fehler: " + r.error : r.changed ? "Synchronisiert – neue Daten übernommen." : "Synchronisiert."); } }, "Jetzt synchronisieren"),
             h("button", { class: "btn-ghost btn-danger", onclick: async () => { if (await confirmSheet("Dropbox-Verbindung trennen? Deine Daten bleiben lokal erhalten.", { okLabel: "Trennen", danger: true })) { await dropbox.disconnect(); renderSettings(); } } }, "Trennen")),
           h("label", { class: "row mt", style: { fontWeight: 400 } }, autoBox, " Automatisch nach jeder Lektion synchronisieren")]
        : [h("p", { class: "small muted" }, "Sichert Fortschritt, Wiederholungsdaten und das Ereignis-Log in deinem Dropbox-App-Ordner und gleicht mehrere Geräte ab."),
           standalone
             ? [h("button", { class: "btn-primary btn-block", onclick: () => connectBtn(true) }, "Mit Dropbox verbinden"), manualBox,
                h("p", { class: "small muted mt" }, "Hinweis: Im Home-Bildschirm-Modus funktioniert die automatische Rückleitung von Dropbox nicht zuverlässig, deshalb der Weg über den Code.")]
             : [h("button", { class: "btn-primary btn-block", onclick: () => connectBtn(false) }, "Mit Dropbox verbinden"),
                h("button", { class: "btn-ghost btn-block btn-small mt", onclick: () => connectBtn(true) }, "Alternativ: per Code verbinden"), manualBox]],
  );
  replace(main, 
    h("h1", {}, "Einstellungen"),
    h("div", { class: "card" }, h("h3", { style: { marginTop: 0 } }, "Tagesziel"), goalSeg),
    dropboxCard,
    h("div", { class: "card" },
      h("h3", { style: { marginTop: 0 } }, "Sicherung als Datei"),
      h("p", { class: "small muted" }, "iOS kann Website-Daten nach 7 Tagen ohne Nutzung löschen. Mit Dropbox-Sync ist das abgefangen; zusätzlich kannst du hier jederzeit eine Datei exportieren und wieder importieren."),
      h("div", { class: "row" }, h("button", { class: "grow", onclick: () => sync.exportToFile() }, "Exportieren"), h("button", { class: "grow", onclick: () => fileInput.click() }, "Importieren"), fileInput),
    ),
    h("div", { class: "card" },
      h("h3", { style: { marginTop: 0 } }, "Daten"),
      h("p", { class: "small muted" }, `${store.events.length} Ereignisse · ${store.wordList().length} Wörter mit Lernstand · Version ${CONFIG.APP_VERSION}`),
      h("button", { class: "btn-block btn-danger", onclick: async () => { if (await confirmSheet("Wirklich ALLE lokalen Lerndaten löschen? (Dropbox bleibt unverändert, bis du erneut synchronisierst.)", { okLabel: "Alles löschen", danger: true })) { await store.resetAll(); toast("Lokale Daten gelöscht."); renderSettings(); } } }, "Lokalen Fortschritt zurücksetzen"),
    ),
    isIOS() && !standalone ? h("div", { class: "card" }, h("h3", { style: { marginTop: 0 } }, "Als App installieren"), h("p", { class: "small" }, "Safari: Teilen-Symbol → „Zum Home-Bildschirm“. Dann läuft die App im Vollbild und offline.")) : null,
  );
  main.scrollTop = 0;
}

boot();
