// Vokabeltrainer: trainiert gezielt fällige, fehleranfällige und schwache Wörter – getrennt vom Lektionspfad.
import { h, esc, shuffle, toast, replace } from "./ui.js";
import { isAnswerAcceptable } from "./answer.js";
import { weightFor, isDue, todayKey, categoryOf } from "./srs.js";
import { db } from "./db.js";
import { store } from "./store.js";

/**
 * Wortauswahl: 1. fällige SRS-Wörter, 2. Wörter mit Fehlern in den letzten 7 Tagen,
 * 3. niedrigste Trefferquote. Gemeisterte nur bei includeMastered.
 */
export function selectWords(content, { size, includeMastered = false, only = null }) {
  const completed = store.completedSet();
  // Kandidaten: Wörter aus abgeschlossenen oder begonnenen Lektionen bzw. mit SRS-Stand
  const known = content.glossary.entries.filter((e) => completed.has(e.lesson) || (store.words.get(e.ceb)?.stage ?? 0) > 0);
  let pool = only ? content.glossary.entries.filter((e) => only.includes(e.ceb)) : known;
  if (!includeMastered) pool = pool.filter((e) => categoryOf(store.words.get(e.ceb)) !== "gemeistert");
  const today = todayKey();
  const weekAgo = Date.now() - 7 * 86400000;
  const recentWrong = new Set();
  for (const ev of store.events) if (ev.type === "answer" && !ev.correct && ev.t >= weekAgo) for (const w of ev.words || []) recentWrong.add(w);
  const rate = (e) => { const w = store.words.get(e.ceb); if (!w || w.correct + w.wrong === 0) return 0.5; return w.correct / (w.correct + w.wrong); };
  const due = shuffle(pool.filter((e) => isDue(store.words.get(e.ceb), today)));
  const wrong = shuffle(pool.filter((e) => !due.includes(e) && recentWrong.has(e.ceb)));
  const rest = pool.filter((e) => !due.includes(e) && !wrong.includes(e)).sort((a, b) => rate(a) - rate(b) || Math.random() - 0.5);
  const ordered = [...due, ...wrong, ...rest];
  const n = size === "all" ? Math.max(due.length, Math.min(10, ordered.length)) : size;
  return ordered.slice(0, n).map((e) => ({ entry: e, due: due.includes(e) }));
}

export async function mountTrainer(main, { content, preset = null, onExit, isCurrent = () => true }) {
  let saved = await db.kvGet("trainer.inprogress");
  if (!isCurrent()) return;
  if (saved && (!Array.isArray(saved.items) || !saved.items.every((i) => content.entry(i.ceb)))) { saved = null; await db.kvDel("trainer.inprogress"); }

  function renderSetup() {
    const s = store.settings;
    let mode = preset?.mode || s.trainerMode || "easy";
    let size = s.trainerSize || 10;
    let all = false;
    const completed = store.completedSet();
    const dueN = store.dueWords().length;
    const seg = (opts, cur, onPick) => {
      const wrap = h("div", { class: "seg" });
      const btns = opts.map(([v, label]) => h("button", { class: v === cur ? "on" : "", onclick: () => { onPick(v); btns.forEach((b, i) => b.classList.toggle("on", opts[i][0] === v)); } }, label));
      wrap.append(...btns);
      return wrap;
    };
    const allBox = h("input", { type: "checkbox", style: { width: "auto" }, onchange: (e) => (all = e.target.checked) });
    const start = h("button", { class: "btn-primary btn-block btn-big mt", onclick: async () => {
      await store.setSetting("trainerMode", mode);
      await store.setSetting("trainerSize", size);
      const words = selectWords(content, { size, includeMastered: all, only: preset?.words || null });
      if (!words.length) return toast("Noch keine Wörter zum Üben – erst eine Lektion abschließen.");
      startRound({ mode, items: words.map((w) => ({ ceb: w.entry.ceb, due: w.due })) });
    } }, "Runde starten");
    replace(main, 
      h("h1", {}, "Vokabeltrainer"),
      saved ? h("div", { class: "card accent" }, h("b", {}, "Unterbrochene Runde"), h("p", { class: "muted" }, `${Math.max(0, saved.items.length + (saved.queueExtra?.length || 0) - saved.pos)} Wörter übrig`),
        h("div", { class: "row mt" }, h("button", { class: "grow", onclick: () => resumeRound(saved) }, "Weitermachen"), h("button", { class: "btn-ghost", onclick: async () => { await db.kvDel("trainer.inprogress"); saved = null; renderSetup(); } }, "Verwerfen"))) : null,
      h("div", { class: "card" },
        h("label", {}, "Modus"),
        seg([["easy", "Einfach (auswählen)"], ["hard", "Schwer (tippen)"]], mode, (v) => (mode = v)),
        h("p", { class: "small muted" }, mode === "easy" ? "" : "", "Einfach: Wort → 4 Bedeutungen. Schwer: Deutsch → Cebuano eintippen (zählt doppelt für die Wiederholung)."),
        h("label", {}, "Umfang"),
        seg([[10, "10"], [20, "20"], ["all", "Alle fälligen"]], size, (v) => (size = v)),
        h("label", { class: "row", style: { fontWeight: 400 } }, allBox, " Alles wiederholen (auch gemeisterte Wörter)"),
      ),
      h("div", { class: "card" },
        h("div", { class: "row spread" }, h("span", {}, "Fällige Wörter"), h("b", {}, dueN)),
        h("div", { class: "row spread" }, h("span", {}, "Gelernte Wörter"), h("b", {}, store.wordList().filter((w) => w.stage > 0).length)),
        h("div", { class: "row spread" }, h("span", {}, "Abgeschlossene Lektionen"), h("b", {}, completed.size)),
      ),
      preset?.words ? h("p", { class: "muted" }, `Gezielte Runde mit ${preset.words.length} Wörtern.`) : null,
      start,
    );
    main.scrollTop = 0;
  }

  function startRound({ mode, items }) {
    const st = { mode, items, pos: 0, startedAt: Date.now(), results: {}, queueExtra: [], activeMs: 0 };
    runRound(st);
  }
  function resumeRound(st) { runRound(st); }

  function runRound(st) {
    document.body.classList.add("lesson-mode");
    const save = () => db.kvSet("trainer.inprogress", st);
    let exStart = Date.now();
    const total = () => st.items.length + st.queueExtra.length;

    function header() {
      const pct = Math.round((st.pos / total()) * 100);
      return h("div", { class: "lesson-top" },
        h("button", { class: "btn-ghost btn-small", onclick: async () => { await save(); document.body.classList.remove("lesson-mode"); toast("Runde gespeichert."); onExit(); } }, "✕"),
        h("div", { class: "progress" }, h("i", { style: { width: pct + "%" } })),
        h("div", { class: "xp" }, `${st.pos}/${total()}`),
      );
    }

    function current() {
      if (st.pos < st.items.length) return st.items[st.pos];
      return st.queueExtra[st.pos - st.items.length];
    }

    let answered = false;
    function render() {
      if (!isCurrent()) return;
      if (st.pos >= total()) return renderSummary();
      const item = current();
      const entry = content.entry(item.ceb);
      if (!entry) { st.pos++; return render(); } // Wort nicht mehr im Glossar
      exStart = Date.now();
      answered = false;
      const body = h("div", {});
      replace(main, header(), body);
      main.scrollTop = 0;
      if (st.mode === "hard") renderHard(entry, item, body);
      else renderEasy(entry, item, body);
    }

    function renderEasy(entry, item, body) {
      const reverse = Math.random() < 0.3; // gelegentlich Deutsch → Cebuano
      const dis = content.distractors(entry, 3);
      const opts = shuffle([entry, ...dis]);
      let sel = null;
      const label = (e) => (reverse ? e.ceb : e.de);
      const btns = opts.map((e) => h("button", { class: "opt", onclick: () => { sel = e; btns.forEach((b, i) => b.classList.toggle("sel", opts[i] === e)); check.disabled = false; } }, label(e)));
      const check = h("button", { class: "btn-primary btn-block btn-big mt", disabled: true, onclick: () => {
        const ok = sel === entry;
        btns[opts.indexOf(entry)].classList.add("ok");
        if (!ok) btns[opts.indexOf(sel)].classList.add("bad");
        finish(entry, item, { correct: ok, near: false, expected: `${entry.ceb} = ${entry.de}`, note: ok ? null : entry.note || null });
      } }, "Prüfen");
      body.append(h("div", { class: "hint" }, reverse ? "Welches Cebuano-Wort passt?" : "Was bedeutet das?"), h("div", { class: "prompt" }, reverse ? entry.de : entry.ceb), h("div", { class: "options" }, btns), check);
    }
    const dontKnow = (entry, item) => h("button", { class: "btn-ghost btn-block btn-small", onclick: () => finish(entry, item, { correct: false, near: false, expected: entry.ceb, note: entry.note || null }) }, "Weiß ich nicht – Lösung zeigen");

    function renderHard(entry, item, body) {
      const input = h("input", { type: "text", autocomplete: "off", autocorrect: "off", autocapitalize: "off", spellcheck: "false", placeholder: "Auf Cebuano …", enterkeyhint: "done" });
      const submit = () => {
        if (!input.value.trim()) return;
        const r = isAnswerAcceptable(input.value, entry.ceb, entry.forms || []);
        input.blur();
        finish(entry, item, { correct: r.ok, near: r.near, expected: entry.ceb, note: entry.note || null });
      };
      input.addEventListener("keydown", (e) => { if (e.key === "Enter") submit(); });
      body.append(h("div", { class: "hint" }, "Tippe das Wort auf Cebuano"), h("div", { class: "prompt" }, entry.de), input,
        h("button", { class: "btn-primary btn-block btn-big mt", onclick: submit }, "Prüfen"), dontKnow(entry, item), h("div", { class: "kbd-space" }));
      setTimeout(() => input.focus(), 50);
    }

    async function finish(entry, item, res) {
      if (answered || !isCurrent()) return;
      answered = true;
      main.querySelectorAll("button, input").forEach((b) => { if (b.textContent !== "✕") b.disabled = true; });
      const dur = Date.now() - exStart;
      st.activeMs += Math.min(dur, 120000);
      const r = (st.results[entry.ceb] ??= { correct: 0, near: 0, wrong: 0 });
      const firstTry = r.correct + r.near + r.wrong === 0;
      if (!res.correct) r.wrong++; else if (res.near) r.near++; else r.correct++;
      const mode = st.mode === "hard" ? "trainer_hard" : "trainer_easy";
      await store.recordAnswer({ mode, exType: st.mode === "hard" ? "type_answer" : "multiple_choice", words: [entry.ceb], correct: res.correct, near: res.near, dur, weight: weightFor(null, mode), firstTry, due: !!item.due && firstTry });
      if (!res.correct) st.queueExtra.push({ ceb: entry.ceb, due: false }); // in derselben Runde nochmal
      st.pos++;
      await save();
      feedback(res, render);
    }

    function feedback(res, next) {
      const cls = !res.correct ? "bad" : res.near ? "near" : "ok";
      const title = !res.correct ? "Leider falsch" : res.near ? "Fast – richtig wäre:" : "Richtig!";
      const go = () => { document.removeEventListener("keydown", onKey); if (!fb.isConnected || !isCurrent()) return; fb.remove(); next(); };
      const onKey = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } };
      const fb = h("div", { class: "feedback " + cls, onclick: (e) => { if (e.target === fb) go(); } }, h("h3", {}, title), (res.near || !res.correct) ? h("div", { class: "exp" }, res.expected) : null, res.note ? h("div", { class: "note" }, res.note) : null,
        h("button", { class: "btn-primary btn-block btn-big mt", onclick: go }, "Weiter"));
      document.body.append(fb);
      document.addEventListener("keydown", onKey);
    }

    async function renderSummary() {
      await db.kvDel("trainer.inprogress");
      document.body.classList.remove("lesson-mode");
      const rows = Object.entries(st.results);
      const correct = rows.filter(([, r]) => r.wrong === 0 && r.near === 0).length;
      const near = rows.filter(([, r]) => r.wrong === 0 && r.near > 0).length;
      const wrong = rows.filter(([, r]) => r.wrong > 0).length;
      const wobbly = rows.filter(([, r]) => r.wrong > 0 || r.near > 0).map(([ceb]) => ceb);
      await store.completeTrainerRound({ mode: st.mode, size: st.items.length, correct, near, wrong, dur: st.activeMs });
      replace(main, 
        h("h1", { class: "center" }, "Runde fertig"),
        h("div", { class: "stat-grid" },
          h("div", { class: "stat" }, h("b", { style: { color: "var(--ok)" } }, correct), h("span", {}, "richtig")),
          h("div", { class: "stat" }, h("b", { style: { color: "var(--warn)" } }, near), h("span", {}, "fast")),
          h("div", { class: "stat" }, h("b", { style: { color: "var(--bad)" } }, wrong), h("span", {}, "falsch")),
        ),
        wobbly.length ? h("div", { class: "card vocab-list mt" }, h("h3", { style: { marginTop: 0 } }, "Noch wackelig"),
          wobbly.map((ceb) => { const e = content.entry(ceb); return h("div", { class: "v" }, h("b", {}, e.ceb), h("span", { class: "muted" }, e.de)); })) : h("p", { class: "center muted mt" }, "Alles sicher – stark!"),
        wobbly.length ? h("button", { class: "btn-primary btn-block btn-big mt", onclick: () => startRound({ mode: st.mode, items: wobbly.map((ceb) => ({ ceb, due: false })) }) }, "Die Wackler gleich nochmal") : null,
        h("button", { class: "btn-block mt", onclick: () => { onExit(); } }, "Zurück"),
      );
      main.scrollTop = 0;
      document.dispatchEvent(new CustomEvent("trainer-complete"));
    }

    render();
  }

  if (preset?.words) {
    const items = selectWords(content, { size: preset.words.length, includeMastered: true, only: preset.words });
    if (items.length) { saved = null; return startRound({ mode: preset.mode || store.settings.trainerMode || "easy", items: items.map((w) => ({ ceb: w.entry.ceb, due: w.due })) }); }
    toast("Keine passenden Wörter gefunden.");
  }
  if (preset?.quick) {
    const items = selectWords(content, { size: 10 });
    if (items.length) { saved = null; return startRound({ mode: preset.mode || "easy", items: items.map((w) => ({ ceb: w.entry.ceb, due: w.due })) }); }
    toast("Noch keine Wörter zum Üben – erst eine Lektion abschließen.");
  }
  renderSetup();
}
