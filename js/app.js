// Einstieg: Router, Startbildschirm, Lernpfad, Wörterliste, Überraschungssätze, Einstellungen.
import { eagleSays, eagle, unitBadge, homeLine } from "./art.js";
import { pronounce, PRON_LEGEND } from "./pronounce.js";
import { mountStory } from "./story.js";
import { mountBlitz } from "./trainer.js";
import { renderConfusables } from "./confusables.js";
import { portrait } from "./characters.js";
import { h, esc, toast, sheet, confirmSheet, fmtTime, isStandalone, isIOS, replace, copyText } from "./ui.js";
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
let swRegistration = null;
function showUpdateBanner() {
  if (document.querySelector(".banner")) return;
  const b = h("div", { class: "banner" }, h("span", { class: "grow" }, "Neue Version verfügbar."),
    h("button", { onclick: () => { swRegistration?.waiting?.postMessage("skipWaiting"); setTimeout(() => location.reload(), 300); } }, "Neu laden"),
    h("button", { "aria-label": "Schließen", class: "btn-ghost", style: { color: "inherit" }, onclick: () => b.remove() }, "✕"));
  document.body.append(b);
}

async function boot() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").then((reg) => {
      swRegistration = reg;
      if (reg.waiting && navigator.serviceWorker.controller) showUpdateBanner();
      reg.addEventListener("updatefound", () => {
        const w = reg.installing;
        w && w.addEventListener("statechange", () => { if (w.state === "installed" && navigator.serviceWorker.controller) showUpdateBanner(); });
      });
    }).catch((e) => console.warn("SW", e));
    // Nur neu laden, wenn vorher schon ein Service Worker aktiv war (= echtes Update, vom Nutzer per Banner ausgelöst)
    const hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener("controllerchange", () => { if (hadController && !window.__reloading) { window.__reloading = true; location.reload(); } });
  }
  try { if (localStorage.getItem("bigText") === "1") document.body.classList.add("big-text"); } catch (_) {}
  const softRender = () => { const r = (location.hash || "#home").slice(1).split("/")[0]; if (!["lesson", "trainer", "blitz", "story", "intro"].includes(r)) render(); };
  window.addEventListener("online", softRender);
  window.addEventListener("offline", softRender);
  try {
    content = await loadContent();
  } catch (e) {
    replace(main, h("div", { class: "card" }, h("h2", {}, "Inhalte konnten nicht geladen werden"), h("p", { class: "muted small" }, "Bitte Internet prüfen und noch einmal versuchen."), h("button", { class: "btn-primary btn-block mt", onclick: () => location.reload() }, "Nochmal versuchen")));
    return;
  }
  await store.init(content);
  await sync.init();
  try { const r = await store.maintainStreak(); if (r.used) toast(`❄️ Streak-Freeze eingesetzt – dein Streak lebt.`, 4000); } catch (e) { console.warn("Streak", e); }

  // OAuth-Redirect von Dropbox?
  try {
    if (await dropbox.handleRedirect()) {
      toast("Mit Dropbox verbunden.");
      location.hash = "#settings";
      sync.run("connect").then(() => softRender());
    }
  } catch (e) {
    toast(e.message, 5000);
  }

  // Automatischer Sync beim Start
  if (store.settings.autoSync && (await sync.canSync())) {
    sync.run("start").then((r) => { if (r.changed) { toast("Fortschritt von Dropbox übernommen."); softRender(); } });
  }
  document.addEventListener("lesson-complete", () => { if (store.settings.autoSync) sync.run("lesson"); if (store.earnedFreeze) { store.earnedFreeze = false; setTimeout(() => toast("❄️ 7 Tage am Stück – du hast einen Streak-Freeze verdient!", 4000), 800); } });
  document.addEventListener("trainer-complete", () => { if (store.settings.autoSync) sync.run("trainer"); if (store.earnedFreeze) { store.earnedFreeze = false; setTimeout(() => toast("❄️ 7 Tage am Stück – du hast einen Streak-Freeze verdient!", 4000), 800); } });
  sync.onChange(() => document.querySelectorAll("[data-sync-status]").forEach((el) => (el.textContent = syncStatusText())));

  window.addEventListener("hashchange", render);
  if (!location.hash) location.hash = "#home";
  if (!(await db.kvGet("onboarded")) && !store.completedSet().size && location.hash === "#home") location.hash = "#intro";
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
  await db.kvSet("review.lastShownWeek", wk);
  showWeeklyReview(false);
}

function showWeeklyReview(asPage) {
  const lines = weeklyReviewText(content) || ["In der letzten Woche gab es noch keine Lernaktivität – diese Woche geht's los!"];
  if (asPage) {
    replace(main, h("h1", {}, "Wochenrückblick"), h("div", { class: "card" }, lines.map((l) => h("p", {}, l))), h("p", { class: "small muted" }, "Erscheint automatisch beim ersten Öffnen an einem Montag."));
    return;
  }
  const c = h("div", {}, h("h2", { style: { marginTop: 0 } }, "Dein Wochenrückblick"), lines.map((l) => h("p", {}, l)),
    h("button", { class: "btn-primary btn-block mt", onclick: () => s.close() }, "Auf in die neue Woche"));
  const s = sheet(c);
}

function greeting() {
  const hr = new Date().getHours();
  if (hr < 11) return "Maayong buntag!";
  if (hr < 13) return "Maayong udto!";
  if (hr < 18) return "Maayong hapon!";
  return "Maayong gabii!";
}

// ---------- Router ----------
let renderSeq = 0;
async function render() {
  const my = ++renderSeq;
  const isCurrent = () => my === renderSeq;
  const hash = location.hash || "#home";
  const [route, ...rest] = hash.slice(1).split("/");
  const param = rest.join("/");
  document.body.classList.remove("lesson-mode");
  main.classList.remove("nobounce");
  document.querySelectorAll(".feedback, .overlay").forEach((e) => e.remove());
  tabs.querySelectorAll("a").forEach((a) => { const on = a.getAttribute("href") === "#" + route || (["more", "words", "surprises", "settings", "grammar", "review", "pron", "culture", "stories", "intro", "confuse"].includes(route) && a.getAttribute("href") === "#more"); a.classList.toggle("active", on); if (on) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current"); });
  switch (route) {
    case "home": return renderHome(isCurrent);
    case "path": return renderPath(isCurrent);
    case "lesson": return mountLesson(main, param, { content, navigate, isCurrent, onExit: (hash) => { if (hash && hash === location.hash) render(); else navigate(hash || "#path"); } });
    case "grammar": return renderGrammar();
    case "pron": return renderPron();
    case "culture": return renderCulture();
    case "confuse": return renderConfusables(main, { content, navigate });
    case "stories": return renderStories();
    case "story": return mountStory(main, param, { content, isCurrent, onExit: (hash) => navigate(hash || "#path") });
    case "blitz": return mountBlitz(main, { content, isCurrent, onExit: (hash) => navigate(hash || "#home") });
    case "intro": return renderOnboarding();
    case "review": return showWeeklyReview(true);
    case "trainer": {
      let preset = null;
      if (param.startsWith("preset")) {
        const q = new URLSearchParams(param.split("?")[1] || "");
        preset = { words: (q.get("words") || "").split("|").filter(Boolean), mode: q.get("mode") || null };
      } else if (param === "review") {
        const due = store.dueWords().map((w) => w.ceb);
        preset = { words: due, mode: store.settings.trainerMode };
      } else if (param === "quick") {
        preset = { quick: true, mode: store.settings.trainerMode };
      } else if (param === "mini") {
        preset = { quick: true, size: 5, mode: "easy" };
      }
      return mountTrainer(main, { content, preset, isCurrent, onExit: () => navigate("#home") });
    }
    case "progress": return renderProgress(main, { content, navigate });
    case "words": return renderWords();
    case "surprises": return renderSurprises();
    case "settings": return renderSettings(isCurrent);
    case "more": return renderMore();
    default: return renderHome();
  }
}

// ---------- Start-Bildschirm ----------
const unitLen = (u) => content.lessons.filter((l) => l.unit === u).length;
async function renderHome(isCurrent = () => true) {
  const s = getStats(content);
  const completed = store.completedSet();
  const inProgress = await hasLessonInProgress();
  const canSync = await sync.canSync();
  const blitzBest = await store.blitzBest();
  if (!isCurrent()) return;
  const nextId = (inProgress && content.lesson(inProgress.lessonId) ? inProgress.lessonId : null) || content.nextLessonId(completed);
  const next = nextId ? content.lesson(nextId) : null;
  const activeToday = !!s.heatmap.find((d) => d.date === s.today)?.active;
  replace(main,
    eagleSays(s.lessonsToday >= s.dailyGoal ? "cheer" : "wave", [h("b", {}, greeting()), homeLine({ streak: s.streak, lessonsToday: s.lessonsToday, dailyGoal: s.dailyGoal, dueCount: s.dueCount, inProgress: !!inProgress, allDone: !next })]),
    s.streak > 0 && !activeToday ? h("div", { class: "streak-warn mb" },
      h("div", {}, `🔥 ${s.streak} Tage Streak – heute noch nichts gelernt.` + (s.freezes ? ` Zur Not hast du ❄️ ${s.freezes} Freeze in Reserve.` : "")),
      h("div", { class: "row mt", style: { marginTop: "8px" } }, h("button", { class: "btn-small btn-primary grow", onclick: () => navigate("#trainer/mini") }, "Streak retten: 5 Wörter (2 min)"))) : null,
    s.streak === 0 && s.longest > 0 && !activeToday ? h("div", { class: "streak-warn mb" }, `Dein Rekord: ${s.longest} Tage am Stück. Heute geht's wieder los.`) : null,
    h("div", { class: "stat-grid" },
      h("div", { class: "stat", role: "button", tabindex: "0", onclick: () => toast(`❄️ Freezes: ${s.freezes} von 2. Ein Freeze rettet einen verpassten Tag von selbst. Alle 7 Streak-Tage gibt es einen neuen. Auch Mini-Runde, Blitz oder Geschichte halten den Streak.`, 6000) }, h("b", {}, s.streak + " 🔥"), h("span", {}, `Streak · ❄️ ${s.freezes}`)),
      h("div", { class: "stat" }, h("b", {}, `${s.lessonsToday}/${s.dailyGoal}`), h("span", {}, "Tagesziel")),
      h("div", { class: "stat" }, h("b", {}, s.xpToday), h("span", {}, "XP heute")),
    ),
    h("div", { class: "card accent mt" },
      next
        ? [h("div", { class: "muted small" }, inProgress ? "Angefangene Lektion" : `Unit ${next.unit}: ${next.unitTitle}`),
           h("h2", { style: { margin: "4px 0 10px" } }, next.title),
           h("div", { class: "unit-dots", "aria-label": `Lektion ${next.posInUnit} von ${unitLen(next.unit)}` }, Array.from({ length: unitLen(next.unit) }, (_, i) => h("i", { class: i < next.posInUnit - 1 ? "on" : i === next.posInUnit - 1 ? "cur" : "" })), h("span", { class: "small" }, `Lektion ${next.posInUnit} von ${unitLen(next.unit)}`)),
           h("button", { class: "btn-block btn-big mt", style: { background: "var(--card)", color: "var(--text)" }, onclick: () => navigate("#lesson/" + next.id) }, inProgress ? "Weitermachen" : "Weiter")]
        : [h("h2", {}, `Alle ${content.lessons.length} Lektionen geschafft!`), h("p", {}, "Halte deinen Wortschatz mit dem Trainer frisch.")],
    ),
    h("div", { class: "card" },
      h("div", { class: "row spread" }, h("div", {}, h("b", {}, s.dueCount), s.dueCount === 1 ? " Wort fällig" : " Wörter fällig"), h("button", { class: "btn-small " + (s.dueCount ? "btn-primary" : ""), disabled: !s.dueCount, onclick: () => navigate("#trainer/review") }, "Wiederholen")),
      h("div", { class: "row spread mt" }, h("div", { class: "small muted" }, "Mini-Runde: 5 Wörter, hält den Streak"), h("button", { class: "btn-small", disabled: !s.learnedWords, onclick: () => navigate("#trainer/mini") }, "Mini")),
      h("div", { class: "row spread mt" }, h("div", { class: "small muted" }, "Trainer: 10 Wörter üben"), h("button", { class: "btn-small", disabled: !s.learnedWords, onclick: () => navigate("#trainer/quick") }, "Trainer")),
      h("div", { class: "row spread mt" }, h("div", { class: "small muted" }, `⚡ 60 Sekunden · Rekord ${blitzBest}`), h("button", { class: "btn-small", disabled: s.learnedWords < 4, onclick: () => navigate("#blitz") }, "Blitzrunde")),
    ),
    h("div", { class: "card row spread" },
      h("div", {}, h("b", {}, s.learnedWords), h("span", { class: "small muted" }, " Wörter gelernt")),
      h("div", {}, h("b", {}, s.xpTotal), h("span", { class: "small muted" }, " XP gesamt")),
      h("div", {}, h("b", {}, s.level), h("span", { class: "small muted" }, " Niveau")),
    ),
    canSync ? h("p", { class: "small muted center", "data-sync-status": "" }, syncStatusText()) : null,
    navigator.onLine ? null : h("p", { class: "small muted center offline" }, "Offline – alles läuft weiter, Sync folgt später."),
  );
  main.scrollTop = 0;
}

// ---------- Lernpfad ----------
async function renderPath(isCurrent = () => true) {
  const completed = store.completedSet();
  const inProgress = await hasLessonInProgress();
  const storiesDone = await store.storiesDone();
  if (!isCurrent()) return;
  const nextId = content.nextLessonId(completed);
  const els = [h("h1", {}, "Lernpfad")];
  if (!content.units.length) els.push(h("p", {}, "Keine Units gefunden."));
  for (const u of content.units) {
    const doneN = u.lessons.filter((l) => completed.has(l.id)).length;
    const unitState = doneN === u.lessons.length ? "done" : u.lessons.some((l) => completed.has(l.id) || content.isUnlocked(l.id, completed)) ? "open" : "locked";
    els.push(h("div", { class: "unit-head" }, unitBadge(u.unit, unitState, 48),
      h("div", { class: "t" }, h("h2", { style: { margin: 0 } }, `Unit ${u.unit}: ${u.title}`),
        h("div", { class: "small muted" }, `${doneN}/${u.lessons.length} Lektionen${unitState === "done" ? " · Abzeichen verdient" : ""}`)),
      h("span", { class: "lvl" }, u.level)));
    const path = h("div", { class: "path" });
    u.lessons.forEach((l, i) => {
      const isDone = completed.has(l.id);
      const isNext = l.id === nextId;
      const unlocked = isDone || content.isUnlocked(l.id, completed);
      const p = store.progress.get(l.id);
      const started = inProgress?.lessonId === l.id;
      const node = h("a", { class: "node " + (started ? "inprogress" : isDone ? "done" : isNext ? "next" : unlocked ? "" : "locked"), href: unlocked ? "#lesson/" + l.id : null, onclick: unlocked ? null : (e) => { e.preventDefault(); toast("Erst die vorherige Lektion abschließen."); } },
        h("div", { class: "num" }, started ? "▶" : isDone ? "✓" : unlocked ? String(i + 1) : "🔒"),
        h("div", { class: "t" }, h("b", {}, l.title), h("span", {}, isDone ? `Beste Quote ${p?.bestAccuracy ?? 0} % · nochmal üben` : inProgress?.lessonId === l.id ? "angefangen – weitermachen" : `${l.vocab.length} Wörter · ${(content.lesson(l.id) || l).exercises.filter((e) => e.type !== "grammar_note").length} Übungen`)),
      );
      path.append(node);
    });
    const story = content.storyOfUnit(u.unit);
    if (story) {
      const open = content.storyUnlocked(story, completed);
      const read = storiesDone.includes(story.id);
      path.append(h("a", { class: "node story-node " + (read ? "done" : open ? "next" : "locked"), href: open ? "#story/" + story.id : null, onclick: open ? null : (e) => { e.preventDefault(); toast("Erst alle Lektionen der Unit abschließen."); } },
        h("div", { class: "num" }, read ? "✓" : open ? "📖" : "🔒"),
        h("div", { class: "t" }, h("b", {}, "Geschichte: " + story.title), h("span", {}, read ? "gelesen · nochmal lesen" : open ? `${story.lines.length} Sprechblasen · ${story.questions.length} Fragen` : "nach Lektion 6")),
      ));
    }
    els.push(path);
  }
  replace(main, ...els);
  const nextEl = main.querySelector(".node.inprogress") || main.querySelector(".node.next");
  if (nextEl) nextEl.scrollIntoView({ block: "center" });
}

// ---------- Wort-Details ----------
function showWordDetail(e) {
  const w = store.words.get(e.ceb);
  const cat = categoryOf(w);
  const l = content.lesson(e.lesson);
  const total = (w?.correct || 0) + (w?.wrong || 0);
  const c = h("div", { class: "word-detail" },
    h("div", { class: "row spread" }, h("h2", { style: { margin: 0 } }, e.ceb), h("span", { class: "badge " + cat }, cat)),
    h("div", { class: "pron" }, pronounce(e.ceb)),
    h("div", { class: "row" }, e.img ? h("div", { class: "vimg big" }, e.img) : null, h("p", { style: { fontSize: "19px", margin: 0 } }, e.de)),
    e.mnemonic ? h("div", { class: "mnemo mt" }, "💡 ", e.mnemonic) : null,
    e.note ? h("p", { class: "muted small" }, e.note) : null,
    e.forms?.length ? h("p", { class: "small muted" }, "Formen: " + e.forms.slice(0, 8).join(", ")) : null,
    h("div", { class: "stat-grid mt" },
      h("div", { class: "stat" }, h("b", {}, w?.correct || 0), h("span", {}, "richtig")),
      h("div", { class: "stat" }, h("b", {}, w?.wrong || 0), h("span", {}, "falsch")),
      h("div", { class: "stat" }, h("b", {}, total ? Math.round(((w.correct || 0) / total) * 100) + " %" : "–"), h("span", {}, "Quote")),
    ),
    h("p", { class: "small muted mt" }, `Stufe ${w?.stage ?? 0} von 5` + (w?.due && w.stage > 0 ? ` · fällig am ${w.due.slice(8, 10)}.${w.due.slice(5, 7)}.` : "") + (l ? ` · eingeführt in Unit ${l.unit}, „${l.title}“` : "")),
    h("div", { class: "row mt" },
      h("button", { class: "grow btn-primary", onclick: () => { s.close(); navigate("#trainer/preset?mode=hard&words=" + encodeURIComponent(e.ceb)); } }, "Jetzt üben"),
      l ? h("button", { class: "grow", onclick: () => { s.close(); navigate("#lesson/" + l.id); } }, "Zur Lektion") : null,
    ),
  );
  const s = sheet(c);
}

// ---------- Grammatik nachschlagen ----------
function renderGrammar() {
  const completed = store.completedSet();
  const els = [h("h1", {}, "Grammatik"), h("p", { class: "muted" }, "Alle Grammatik-Notizen aus abgeschlossenen Lektionen zum Nachschlagen.")];
  let any = false;
  for (const u of content.units) {
    const ls = u.lessons.filter((l) => completed.has(l.id));
    if (!ls.length) continue;
    any = true;
    els.push(h("div", { class: "card grammar-list" }, h("h3", { style: { marginTop: 0 } }, `Unit ${u.unit}: ${u.title}`),
      ls.map((l, i) => h("details", {}, h("summary", {}, `${u.lessons.indexOf(l) + 1}. ${l.grammar.title}`),
        h("div", { class: "grammar" }, h("p", { html: esc(l.grammar.text).replace(/\n/g, "<br>") })),
        l.exercises.filter((e) => e.type === "grammar_note").map((e) => h("div", { class: "grammar" }, h("h3", {}, e.title), h("p", { html: esc(e.text).replace(/\n/g, "<br>") }))),
      ))));
  }
  if (!any) els.push(h("p", {}, "Noch keine abgeschlossene Lektion."));
  replace(main, ...els);
  main.scrollTop = 0;
}

// ---------- Wörterliste ----------
function renderWords() {
  const input = h("input", { type: "search", placeholder: "Suchen (Cebuano oder Deutsch)", autocorrect: "off", autocapitalize: "off", spellcheck: "false" });
  let filter = "alle";
  let showAll = false;
  const list = h("div", { class: "card vocab-list" });
  const count = h("p", { class: "small muted" });
  const completed = store.completedSet();
  const seg = h("div", { class: "seg mb" }, ["alle", "neu", "lernend", "gefestigt", "gemeistert"].map((f) => h("button", { class: f === filter ? "on" : "", onclick: (e) => { filter = f; seg.querySelectorAll("button").forEach((b) => b.classList.toggle("on", b === e.target)); update(); } }, f)));
  const allBox = h("input", { type: "checkbox", style: { width: "auto" }, onchange: (e) => { showAll = e.target.checked; update(); } });
  function update() {
    const q = input.value.trim().toLowerCase();
    const rows = content.glossary.entries.filter((e) => {
      const w = store.words.get(e.ceb);
      const learned = completed.has(e.lesson) || (w && w.stage > 0);
      if (!learned && !showAll) return false;
      const cat = categoryOf(w);
      if (filter !== "alle" && cat !== filter) return false;
      return !q || e.ceb.toLowerCase().includes(q) || e.de.toLowerCase().includes(q) || (e.note || "").toLowerCase().includes(q);
    });
    count.textContent = `${rows.length} Wörter` + (showAll ? " (inkl. noch nicht gelernte)" : "");
    const LIMIT = 80;
    replace(list, rows.length ? rows.slice(0, LIMIT).map((e) => {
      const w = store.words.get(e.ceb);
      const cat = categoryOf(w);
      const learned = completed.has(e.lesson) || (w && w.stage > 0);
      return h("div", { class: "v", role: "button", tabindex: "0", style: learned ? null : { opacity: 0.6 }, onclick: () => showWordDetail(e), onkeydown: (ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); showWordDetail(e); } } }, h("div", { class: "row" }, e.img ? h("span", { class: "vimg small" }, e.img) : null, h("div", {}, h("b", {}, e.ceb), h("span", { class: "pron" }, pronounce(e.ceb)), h("span", { class: "note" }, e.de, e.note ? ` – ${e.note}` : ""))), h("div", { style: { textAlign: "right", flexShrink: 0 } }, learned ? h("span", { class: "badge " + cat }, cat) : h("span", { class: "badge" }, "Unit " + e.lesson.slice(1, 3).replace(/^0/, "")), w?.due && w.stage > 0 ? h("div", { class: "small muted" }, "fällig " + w.due.slice(8, 10) + "." + w.due.slice(5, 7) + ".") : null));
    }) : h("p", { class: "muted" }, showAll ? "Nichts gefunden." : "Keine Wörter – schließe zuerst eine Lektion ab."));
    if (rows.length > LIMIT) list.append(h("p", { class: "small muted center" }, `${rows.length - LIMIT} weitere – Suche eingrenzen, um sie zu sehen.`));
  }
  let debounce = null;
  input.addEventListener("input", () => { clearTimeout(debounce); debounce = setTimeout(update, 150); });
  replace(main, h("h1", {}, "Wörter"), h("div", { class: "search" }, input), seg,
    h("label", { class: "row small", style: { fontWeight: 400, margin: "0 0 10px" } }, allBox, " Auch noch nicht gelernte Wörter zeigen"), count, list);
  main.scrollTop = 0;
  update();
}

// ---------- Für meine Frau ----------
function renderSurprises() {
  const completed = store.completedSet();
  const all = content.surprises();
  const open = all.filter((s) => completed.has(s.lessonId));
  const locked = all.length - open.length;
  replace(main, 
    h("h1", {}, "Für Langga"),
    h("p", { class: "muted" }, "Alle Überraschungssätze aus abgeschlossenen Lektionen."),
    open.length ? open.map((s) => h("div", { class: "surprise mb" }, h("div", { class: "ceb" }, s.ceb), h("div", { class: "pron" }, pronounce(s.ceb)), h("div", { class: "de" }, s.de), h("div", { class: "when" }, `Wann: ${s.when} · Unit ${s.unit}`),
      h("button", { class: "btn-ghost btn-small", onclick: () => copyText(s.ceb) }, "Kopieren"))) : h("p", {}, "Noch keine – die erste Lektion wartet."),
    locked ? h("p", { class: "small muted center" }, `${locked} weitere Sätze warten in den nächsten Lektionen.`) : null,
  );
  main.scrollTop = 0;
}

// ---------- Aussprache-Legende ----------
function renderPron() {
  const samples = ["Maayong buntag", "Kumusta ka?", "Gimingaw ko nimo.", "Gwapa kaayo ka karon, Langga.", "Unsa imong ngalan?", "Nagluto ko ug kan-on."];
  replace(main,
    h("h1", {}, "Aussprache lesen"),
    h("p", { class: "muted" }, "Unter jedem Cebuano-Wort steht kursiv, wie du es mit deutscher Lesegewohnheit aussprichst. Cebuano ist sehr lautgetreu – nur diese Zeichen sind anders:"),
    h("div", { class: "card" }, PRON_LEGEND.map(([k, v]) => h("div", { class: "pron-row" }, h("b", {}, k), h("span", {}, v)))),
    h("h2", {}, "Beispiele"),
    h("div", { class: "card" }, samples.map((s) => h("div", { class: "pron-sample" }, h("b", {}, s), h("div", { class: "pron" }, pronounce(s))))),
    h("p", { class: "small muted" }, "Die Umschrift ist regelbasiert und deckt die normale Aussprache ab. Wo deine Frau anders spricht, gilt ihre Version."),
  );
  main.scrollTop = 0;
}

// ---------- Geschichten-Liste ----------
async function renderStories() {
  const completed = store.completedSet();
  const done = await store.storiesDone();
  replace(main,
    h("h1", {}, "Geschichten"),
    h("p", { class: "muted" }, "Eine Comic-Geschichte pro Unit mit Tim, Langga, Inday, Lola und Manong Dodong. Freigeschaltet, sobald die Unit fertig ist."),
    h("div", { class: "cast mb" }, ["tim", "langga", "inday", "lola", "dodong", "agila"].map((w) => h("div", { class: "cast-item" }, portrait(w, 44), h("span", {}, { tim: "Tim", langga: "Langga", inday: "Inday", lola: "Lola", dodong: "Dodong", agila: "Agila" }[w])))),
    content.stories.length ? h("div", { class: "card list" }, content.stories.map((s) => {
      const open = content.storyUnlocked(s, completed);
      return h("a", { href: open ? "#story/" + s.id : "#stories", class: open ? "" : "locked", onclick: open ? null : (e) => { e.preventDefault(); toast(`Erst Unit ${s.unit} abschließen.`); } },
        (done.includes(s.id) ? "✓ " : open ? "📖 " : "🔒 ") + `Unit ${s.unit}: ${s.title}`);
    })) : h("p", {}, "Noch keine Geschichten vorhanden."),
  );
  main.scrollTop = 0;
}

// ---------- Kultur ----------
function renderCulture() {
  const completed = store.completedSet();
  const startedUnits = new Set([1, ...[...completed].map((id) => content.unitOf(id))]);
  const maxUnit = Math.max(...startedUnits);
  const els = [h("h1", {}, "Wusstest du?"), h("p", { class: "muted" }, "Kleine Kulturkästen zu Cebu und den Philippinen, passend zu den Units. Neue erscheinen mit jeder begonnenen Unit.")];
  if (!content.culture.length) els.push(h("p", {}, "Noch keine Kulturkästen vorhanden."));
  for (const u of content.units) {
    const items = content.cultureOfUnit(u.unit);
    if (!items.length) continue;
    const open = u.unit <= maxUnit;
    els.push(h("h2", {}, `Unit ${u.unit}: ${u.title}`));
    if (!open) { els.push(h("p", { class: "small muted" }, `🔒 ${items.length} Kästen – ab Unit ${u.unit}`)); continue; }
    for (const c of items) els.push(h("div", { class: "culture" }, h("div", { class: "culture-head" }, h("span", { class: "culture-emoji" }, c.emoji), h("b", {}, c.title)), h("p", {}, c.text)));
  }
  replace(main, ...els);
  main.scrollTop = 0;
}

// ---------- Erster Start: kurze Tour ----------
function renderOnboarding() {
  const slides = [
    { mood: "wave", title: "Maayong adlaw! Ich bin Agila.", text: "Ich bringe dir Cebuano bei – in kurzen Lektionen, ein paar Minuten am Tag. Auch ohne Internet." },
    { mood: "think", title: "So lernst du", text: "Erst ein paar neue Wörter mit Bild und Eselsbrücke, dann Übungen. Was du falsch machst, kommt einfach noch einmal dran. Keine Strafen." },
    { mood: "idle", title: "Wiederholen zur richtigen Zeit", text: "Was du lernst, frage ich später noch einmal ab – genau dann, wenn du es sonst vergessen würdest. Der Trainer zeigt dir, was dran ist." },
    { mood: "cheer", title: "Für Langga", text: "Jede Lektion endet mit einem Satz für deine Frau, jede Unit mit einer kleinen Geschichte. Dein Ziel: eine Lektion am Tag." },
  ];
  let i = 0;
  const finish = async () => { await db.kvSet("onboarded", true); navigate("#home"); };
  const draw = () => {
    const s = slides[i];
    replace(main,
      h("div", { class: "onboard" },
        h("div", { class: "mascot-center" }, eagle(s.mood, 170)),
        h("h1", { class: "center" }, s.title),
        h("p", { class: "center", style: { fontSize: "18px" } }, s.text),
        h("div", { class: "dots" }, slides.map((_, k) => h("i", { class: k === i ? "on" : "" }))),
        h("button", { class: "btn-primary btn-block btn-big mt", onclick: () => { if (i < slides.length - 1) { i++; draw(); } else finish(); } }, i < slides.length - 1 ? "Weiter" : "Los geht's"),
        i < slides.length - 1 ? h("button", { class: "btn-ghost btn-block btn-small", onclick: finish }, "Überspringen") : null,
      ),
    );
    main.scrollTop = 0;
  };
  draw();
}

// ---------- Mehr ----------
function renderMore() {
  replace(main, 
    h("h1", {}, "Mehr"),
    h("div", { class: "card list" },
      h("a", { href: "#surprises" }, "💛 Für Langga"),
      h("a", { href: "#stories" }, "📖 Geschichten"),
      h("a", { href: "#words" }, "📚 Wörterliste"),
      h("a", { href: "#grammar" }, "📘 Grammatik"),
      h("a", { href: "#confuse" }, "🔁 Verwechsler (ako, akong, nako …)"),
      h("a", { href: "#pron" }, "🔊 Aussprache"),
      h("a", { href: "#culture" }, "🇵🇭 Wusstest du?"),
      h("a", { href: "#review" }, "🗓️ Wochenrückblick"),
      h("a", { href: "#intro" }, "🦅 Tour"),
      h("a", { href: "#settings" }, "⚙️ Einstellungen"),
    ),
  );
}

// ---------- Einstellungen ----------
async function renderSettings(isCurrent = () => true) {
  const connected = await sync.canSync();
  if (!isCurrent()) return;
  const standalone = isStandalone();
  const goalSeg = h("div", { class: "seg" }, [1, 2, 3].map((n) => h("button", { class: store.settings.dailyGoal === n ? "on" : "", onclick: async (e) => { await store.setSetting("dailyGoal", n); goalSeg.querySelectorAll("button").forEach((b) => b.classList.toggle("on", b === e.target)); } }, `${n} Lektion${n > 1 ? "en" : ""}`)));
  const autoBox = h("input", { type: "checkbox", style: { width: "auto" }, checked: store.settings.autoSync, onchange: (e) => store.setSetting("autoSync", e.target.checked) });
  const codeInput = h("input", { type: "text", placeholder: "Code von Dropbox einfügen", autocorrect: "off", autocapitalize: "off", spellcheck: "false" });
  const openLink = h("a", { class: "btn btn-block btn-outline hidden", target: "_blank", rel: "noopener", style: { textAlign: "center", textDecoration: "none" } }, "Dropbox-Seite öffnen");
  const connectBtn = async (manual) => {
    try {
      if (manual) {
        // Fenster synchron im Tipp-Handler öffnen (sonst blockiert Safari das Popup), URL danach setzen
        const w = window.open("", "_blank");
        const url = await dropbox.startAuth({ manual: true });
        if (w) w.location = url;
        openLink.href = url;
        openLink.classList.remove("hidden");
        manualBox.classList.remove("hidden");
      } else {
        await dropbox.startAuth({ manual: false });
      }
    } catch (e) { toast(e.message, 5000); }
  };
  const manualBox = h("div", { class: standalone ? "mt" : "mt hidden" },
    openLink,
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
        : [h("p", { class: "small muted" }, "Sichert deinen Fortschritt in Dropbox – auch für ein zweites Gerät."),
           standalone
             ? [h("button", { class: "btn-primary btn-block", onclick: () => connectBtn(true) }, "Mit Dropbox verbinden"), manualBox,
                h("p", { class: "small muted mt" }, "Hinweis: Im Home-Bildschirm-Modus funktioniert die automatische Rückleitung von Dropbox nicht zuverlässig, deshalb der Weg über den Code.")]
             : [h("button", { class: "btn-primary btn-block", onclick: () => connectBtn(false) }, "Mit Dropbox verbinden"),
                h("button", { class: "btn-ghost btn-block btn-small mt", onclick: () => connectBtn(true) }, "Alternativ: per Code verbinden"), manualBox]],
  );
  const bigBox = h("input", { type: "checkbox", style: { width: "auto" }, checked: document.body.classList.contains("big-text"), onchange: (e) => { document.body.classList.toggle("big-text", e.target.checked); try { localStorage.setItem("bigText", e.target.checked ? "1" : "0"); } catch (_) {} } });
  let persisted = null;
  try { persisted = navigator.storage?.persisted ? await navigator.storage.persisted() : null; } catch (_) {}
  replace(main,
    h("h1", {}, "Einstellungen"),
    h("div", { class: "card" }, h("h3", { style: { marginTop: 0 } }, "Tagesziel"), goalSeg,
      h("label", { class: "row mt", style: { fontWeight: 400 } }, bigBox, " Große Schrift")),
    dropboxCard,
    h("div", { class: "card" },
      h("h3", { style: { marginTop: 0 } }, "Sicherung als Datei"),
      h("p", { class: "small muted" }, "iOS kann Website-Daten nach 7 Tagen ohne Nutzung löschen. Mit Dropbox-Sync ist das abgefangen; zusätzlich kannst du hier jederzeit eine Datei exportieren und wieder importieren."),
      h("div", { class: "row" }, h("button", { class: "grow", onclick: () => sync.exportToFile() }, "Exportieren"), h("button", { class: "grow", onclick: () => fileInput.click() }, "Importieren"), fileInput),
    ),
    h("div", { class: "card" },
      h("h3", { style: { marginTop: 0 } }, "Daten"),
      h("p", { class: "small muted" }, `${store.events.length} Ereignisse · ${store.wordList().length} Wörter mit Lernstand · Version ${CONFIG.APP_VERSION}` + (persisted === null ? "" : persisted ? " · Speicher dauerhaft" : " · Speicher nicht als dauerhaft markiert")),
      h("button", { class: "btn-block mb", onclick: async () => {
        if (!swRegistration) return toast("Updates gibt es nur in der installierten App.");
        try { await swRegistration.update(); toast(swRegistration.waiting ? "Update bereit – oben auf „Neu laden“ tippen." : "Du hast die neueste Version."); } catch (e) { toast("Update-Prüfung fehlgeschlagen: " + e.message); }
      } }, "Nach Updates suchen"),
      h("button", { class: "btn-block btn-danger", onclick: async () => {
        const text = connected
          ? "Wirklich alles löschen? Auch die Sicherung in Dropbox. Vorher exportieren, wenn du unsicher bist."
          : "Wirklich ALLE lokalen Lerndaten löschen?";
        if (!(await confirmSheet(text, { okLabel: "Alles löschen", danger: true }))) return;
        try {
          if (connected) { await dropbox.deleteFile(CONFIG.DROPBOX_PROGRESS_FILE); await dropbox.deleteFile(CONFIG.DROPBOX_EVENTS_FILE); }
          await store.resetAll();
          toast(connected ? "Lokale Daten und Dropbox-Sicherung gelöscht." : "Lokale Daten gelöscht.");
        } catch (e) { toast("Löschen fehlgeschlagen: " + e.message, 5000); }
        renderSettings();
      } }, "Fortschritt zurücksetzen"),
    ),
    isIOS() && !standalone ? h("div", { class: "card" }, h("h3", { style: { marginTop: 0 } }, "Als App installieren"), h("p", { class: "small" }, "Safari: Teilen-Symbol → „Zum Home-Bildschirm“. Dann läuft die App im Vollbild und offline.")) : null,
  );
  main.scrollTop = 0;
}

boot();
