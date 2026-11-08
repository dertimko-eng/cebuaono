// Sätze: Themen-Sammlungen (Langga, Familie, Arbeit …) zum Durchlesen und Üben.
// Getrennt vom Wortschatz-SRS. Der Stand jedes Satzes kommt aus dem Event-Log (answer-Events mit phrase-Feld).
import { h, shuffle, toast, replace } from "./ui.js";
import { eagle, confetti } from "./art.js";
import { pronounce } from "./pronounce.js";
import { normalizeAnswer } from "./answer.js";
import { store, XP } from "./store.js";

export const ROUND_SIZE = 6;
const SICHER_AT = 3; // ab diesem Punktestand gilt ein Satz als sicher

/** Punktestand je Satz aus den Events: +1 richtig, -1 falsch, 0..5. */
export function phraseScores() {
  const m = new Map();
  for (const e of store.events) {
    if (e.type !== "answer" || e.mode !== "phrases" || !e.phrase) continue;
    const s = m.get(e.phrase) || { score: 0, lastAt: 0, n: 0 };
    s.score = Math.max(0, Math.min(5, s.score + (e.correct ? 1 : -1)));
    s.lastAt = e.t; s.n++;
    m.set(e.phrase, s);
  }
  return m;
}
export const statusOf = (s) => !s || s.n === 0 ? "neu" : s.score >= SICHER_AT ? "sicher" : "lernend";

function tokensOf(ceb) { return ceb.split(/\s+/).filter(Boolean); }
const norm = (t) => normalizeAnswer(t);

// Satzauswahl: schwache und lange nicht geübte zuerst
function pick(phrases, n) {
  const sc = phraseScores();
  const key = (p) => { const s = sc.get(p.id); return [s ? s.score : -1, s ? s.lastAt : 0, Math.random()]; };
  return phrases.map((p) => ({ p, k: key(p) })).sort((a, b) => a.k[0] - b.k[0] || a.k[1] - b.k[1] || a.k[2] - b.k[2]).slice(0, n).map((x) => x.p);
}

// ---------- Übersicht ----------
export function renderPhrasesHome(main, { content, navigate }) {
  const cols = content.phrases;
  const sc = phraseScores();
  const all = cols.flatMap((c) => c.phrases);
  const sicher = all.filter((p) => statusOf(sc.get(p.id)) === "sicher").length;
  const started = all.filter((p) => sc.has(p.id)).length;
  replace(main,
    h("h1", {}, "Sätze"),
    h("p", { class: "muted" }, "Ganze Sätze für Langga, die Familie, die Schule und den Alltag. Erst lesen, dann üben. Eine Übungsrunde (6 Sätze) hält den Streak."),
    h("div", { class: "stat-grid" },
      h("div", { class: "stat" }, h("b", {}, sicher), h("span", {}, "sicher")),
      h("div", { class: "stat" }, h("b", {}, started - sicher), h("span", {}, "am Lernen")),
      h("div", { class: "stat" }, h("b", {}, all.length - started), h("span", {}, "neu")),
    ),
    h("div", { class: "card accent mt" },
      h("div", { class: "row spread" }, h("div", {}, h("b", {}, "Gemischte Runde"), h("div", { class: "small", style: { opacity: .9 } }, "6 Sätze aus allen Themen, die Wackligen zuerst")),
        h("button", { class: "btn-small", style: { background: "var(--card)", color: "var(--text)" }, onclick: () => navigate("#phrases/train/mix") }, "Üben")),
    ),
    cols.map((c) => {
      const n = c.phrases.length;
      const done = c.phrases.filter((p) => statusOf(sc.get(p.id)) === "sicher").length;
      const seen = c.phrases.filter((p) => sc.has(p.id)).length;
      return h("div", { class: "card" },
        h("div", { class: "row" }, h("div", { class: "pcol-emoji", "aria-hidden": "true" }, c.emoji), h("div", { class: "grow" }, h("h3", { style: { margin: 0 } }, c.title), h("div", { class: "small muted" }, c.intro))),
        h("div", { class: "row mt", style: { alignItems: "center" } }, h("div", { class: "progress" }, h("i", { style: { width: Math.round((done / n) * 100) + "%" } })), h("span", { class: "small muted" }, `${done}/${n} sicher`)),
        h("div", { class: "row mt" },
          h("button", { class: "grow", onclick: () => navigate("#phrases/learn/" + c.id) }, seen ? "Lesen" : "Kennenlernen"),
          h("button", { class: "grow btn-primary", onclick: () => navigate("#phrases/train/" + c.id) }, "Üben"),
        ),
      );
    }),
  );
  main.scrollTop = 0;
}

// ---------- Lesen: Satz für Satz mit Aussprache, Übersetzung, wörtlich, Hinweis ----------
export function mountPhraseLearn(main, { content, id, onExit, navigate }) {
  const col = content.phraseCollection(id);
  if (!col) { toast("Sammlung nicht gefunden."); return onExit(); }
  const sc = phraseScores();
  let i = 0;
  const exit = (hash) => { document.onkeydown = null; document.body.classList.remove("lesson-mode"); onExit(hash); };
  function render() {
    document.body.classList.add("lesson-mode");
    const p = col.phrases[i];
    const st = statusOf(sc.get(p.id));
    const next = h("button", { class: "btn-primary btn-block btn-big mt", onclick: () => { if (i + 1 < col.phrases.length) { i++; render(); } else renderEnd(); } }, i + 1 < col.phrases.length ? "Weiter" : "Fertig gelesen");
    replace(main,
      h("div", { class: "lesson-top" },
        h("button", { class: "btn-ghost btn-icon", onclick: () => exit("#phrases"), "aria-label": "Schließen" }, "✕"),
        h("div", { class: "progress" }, h("i", { style: { width: Math.round(((i + 1) / col.phrases.length) * 100) + "%" } })),
        h("div", { class: "xp" }, `${i + 1}/${col.phrases.length}`),
      ),
      h("div", { class: "small muted" }, `${col.emoji} ${col.title}`),
      h("div", { class: "card phrase-card" },
        h("div", { class: "phrase-ceb" }, p.ceb),
        h("div", { class: "pron" }, pronounce(p.ceb)),
        h("div", { class: "phrase-de" }, p.de),
        p.lit ? h("div", { class: "phrase-lit" }, h("span", { class: "muted" }, "wörtlich: "), p.lit) : null,
        p.note ? h("div", { class: "mnemo" }, "💡 ", p.note) : null,
        h("div", { class: "small muted mt" }, st === "sicher" ? "✅ sicher" : st === "lernend" ? "🟡 am Lernen" : "🆕 neu"),
      ),
      h("div", { class: "row" },
        h("button", { class: "grow", disabled: i === 0, onclick: () => { if (i > 0) { i--; render(); } } }, "Zurück"),
        h("button", { class: "grow btn-outline", onclick: () => navigate("#phrases/train/" + col.id) }, "Gleich üben"),
      ),
      next,
    );
    main.scrollTop = 0;
    document.onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); next.click(); } };
  }
  function renderEnd() {
    document.onkeydown = null;
    replace(main,
      h("div", { class: "mascot-center" }, eagle("wave", 120)),
      h("h1", { class: "center", style: { marginTop: 0 } }, "Alle gelesen"),
      h("p", { class: "center muted" }, `${col.phrases.length} Sätze aus „${col.title}“. Jetzt üben, dann bleiben sie – und der Streak gleich mit.`),
      h("button", { class: "btn-primary btn-block btn-big mt", onclick: () => navigate("#phrases/train/" + col.id) }, "Jetzt üben (hält den Streak)"),
      h("button", { class: "btn-block mt", onclick: () => exit("#phrases") }, "Zur Übersicht"),
    );
  }
  render();
  return { pause: () => exit() };
}

// ---------- Üben: Runde mit 6 Sätzen (bauen, auswählen, Lücke) ----------
export function mountPhraseTrain(main, { content, id, onExit, isCurrent = () => true }) {
  const col = id === "mix" ? null : content.phraseCollection(id);
  const all = content.phrases.flatMap((c) => c.phrases.map((p) => ({ ...p, col: c.id })));
  const poolAll = col ? all.filter((p) => p.col === col.id) : all;
  if (poolAll.length < 4) { toast("Zu wenige Sätze."); return onExit(); }
  const items = pick(poolAll, ROUND_SIZE).map((p, k) => ({ p, kind: ["build", "choice", "blank"][k % 3] }));
  const queue = [...items];
  let pos = 0, correctN = 0, wrongN = 0, exStart = Date.now(), activeMs = 0, answered = false;
  const results = {};
  const exit = (hash) => { document.body.classList.remove("lesson-mode"); onExit(hash); };
  const byId = (pid) => all.find((p) => p.id === pid);

  function header() {
    return h("div", { class: "lesson-top" },
      h("button", { class: "btn-ghost btn-icon", "aria-label": "Runde abbrechen", onclick: () => exit("#phrases") }, "✕"),
      h("div", { class: "progress" }, h("i", { style: { width: Math.round((pos / queue.length) * 100) + "%" } })),
      h("div", { class: "xp" }, `${pos}/${queue.length}`),
    );
  }

  function render() {
    if (!isCurrent()) return;
    if (pos >= queue.length) return renderSummary();
    document.body.classList.add("lesson-mode");
    const { p, kind } = queue[pos];
    exStart = Date.now(); answered = false;
    const body = h("div", {});
    replace(main, header(), body);
    main.scrollTop = 0;
    ({ build, choice, blank })[kind](p, body);
  }

  // Deutsch → Satz aus Kacheln bauen (plus 2 Ablenker-Kacheln aus anderen Sätzen)
  function build(p, body) {
    const toks = tokensOf(p.ceb);
    const have = new Set(toks.map(norm));
    const extra = shuffle(poolAll.filter((q) => q.id !== p.id).flatMap((q) => tokensOf(q.ceb)).filter((t) => !have.has(norm(t)) && norm(t)))
      .filter((t, i, arr) => arr.findIndex((u) => norm(u) === norm(t)) === i).slice(0, 2);
    const tokens = shuffle([...toks, ...extra].map((t, i) => ({ t, i })));
    const chosen = [];
    const answerBox = h("div", { class: "bank answer" });
    const bankBox = h("div", { class: "bank" });
    const tiles = tokens.map((tk, k) => h("button", { class: "tile", onclick: () => { if (chosen.includes(k)) return; chosen.push(k); draw(); } }, tk.t));
    const check = h("button", { class: "btn-primary btn-block btn-big mt", disabled: true, onclick: () => {
      const got = chosen.map((k) => tokens[k].t).join(" ");
      const ok = norm(got) === norm(p.ceb);
      if (!ok) answerBox.classList.add("bad");
      finish(p, { correct: ok });
    } }, "Prüfen");
    const reset = h("button", { class: "btn-ghost btn-small", onclick: () => { chosen.length = 0; draw(); } }, "Zurücksetzen");
    function draw() {
      answerBox.replaceChildren(...chosen.map((k) => h("button", { class: "tile", onclick: () => { chosen.splice(chosen.indexOf(k), 1); draw(); } }, tokens[k].t)));
      tiles.forEach((t, k) => t.classList.toggle("used", chosen.includes(k)));
      check.disabled = chosen.length === 0;
    }
    bankBox.append(...tiles);
    body.append(h("div", { class: "hint" }, "Baue den Satz aus den Kacheln"), h("div", { class: "prompt small" }, p.de), answerBox, bankBox, h("div", { class: "row spread mt" }, reset), check);
    draw();
  }

  // Cebuano → deutsche Bedeutung auswählen
  function choice(p, body) {
    const dis = shuffle(poolAll.filter((q) => q.id !== p.id && q.de !== p.de)).slice(0, 3);
    const opts = shuffle([p, ...dis]);
    let sel = null;
    const btns = opts.map((q) => h("button", { class: "opt", onclick: () => { sel = q; btns.forEach((b, i) => b.classList.toggle("sel", opts[i] === q)); check.disabled = false; } }, q.de));
    const check = h("button", { class: "btn-primary btn-block btn-big mt", disabled: true, onclick: () => {
      const ok = sel === p;
      btns[opts.indexOf(p)].classList.add("ok");
      if (!ok) btns[opts.indexOf(sel)].classList.add("bad");
      finish(p, { correct: ok });
    } }, "Prüfen");
    body.append(h("div", { class: "hint" }, "Was bedeutet der Satz?"), h("div", { class: "prompt small" }, p.ceb), h("div", { class: "pron under" }, pronounce(p.ceb)), h("div", { class: "options" }, btns), check);
  }

  // Lücke: ein inhaltliches Wort fehlt, 4 Wörter zur Auswahl
  function blank(p, body) {
    const toks = tokensOf(p.ceb);
    const FILLER = new Set(["ko", "ka", "ta", "mi", "mo", "ug", "sa", "ang", "na", "pa", "ra", "ba", "si", "ni", "kog", "koy", "ray", "nga", "lang", "kaayo", "langga", "lola", "inday", "cebu"]);
    const cand = toks.map((t, i) => ({ t, i, w: norm(t) })).filter((x) => x.w && !FILLER.has(x.w) && x.w.length >= 4);
    const target = (cand.length ? cand : toks.map((t, i) => ({ t, i, w: norm(t) }))).sort((a, b) => b.w.length - a.w.length)[Math.floor(Math.random() * Math.min(2, cand.length || 1))];
    const clean = (t) => t.replace(/[.,!?;:…"„“”]+$/g, "");
    const answerWord = clean(target.t);
    const others = shuffle([...new Set(poolAll.filter((q) => q.id !== p.id).flatMap((q) => tokensOf(q.ceb)).map(clean).filter((t) => norm(t) && norm(t) !== norm(answerWord) && norm(t).length >= 3 && !FILLER.has(norm(t))))]).slice(0, 3);
    const opts = shuffle([answerWord, ...others]);
    const gap = h("span", { class: "gap" }, "____");
    const sentence = h("div", { class: "prompt small" }, toks.map((t, i) => [i ? " " : "", i === target.i ? [gap, t.slice(clean(t).length)] : t]));
    let sel = null;
    const btns = opts.map((o) => h("button", { class: "opt", onclick: () => { sel = o; gap.textContent = o; btns.forEach((b) => b.classList.toggle("sel", b.textContent === o)); check.disabled = false; } }, o));
    const check = h("button", { class: "btn-primary btn-block btn-big mt", disabled: true, onclick: () => {
      const ok = norm(sel) === norm(answerWord);
      btns[opts.indexOf(answerWord)].classList.add("ok");
      if (!ok) btns[opts.indexOf(sel)].classList.add("bad");
      finish(p, { correct: ok });
    } }, "Prüfen");
    body.append(h("div", { class: "hint" }, "Welches Wort fehlt?"), h("div", { class: "small muted" }, p.de), sentence, h("div", { class: "options" }, btns), check);
  }

  async function finish(p, res) {
    if (answered || !isCurrent()) return;
    answered = true;
    main.querySelectorAll("button").forEach((b) => { if (b.textContent !== "✕") b.disabled = true; });
    const dur = Date.now() - exStart;
    activeMs += Math.min(dur, 120000);
    const r = (results[p.id] ??= { correct: 0, wrong: 0 });
    if (res.correct) { r.correct++; correctN++; } else { r.wrong++; wrongN++; }
    const kind = queue[pos].kind;
    await store.recordAnswer({ mode: "phrases", exType: kind === "build" ? "word_bank" : kind === "choice" ? "multiple_choice" : "fill_blank", words: [], phrase: p.id, correct: res.correct, near: false, dur, weight: 1, firstTry: r.correct + r.wrong === 1, due: false });
    if (!res.correct && !queue.slice(pos + 1).some((q) => q.p.id === p.id)) queue.push({ p, kind: "choice" }); // leichter nochmal
    pos++;
    feedback(p, res, render);
  }

  function feedback(p, res, next) {
    const praise = ["Richtig!", "Sakto!", "Maayo kaayo!", "Genau so!", "Stark!"];
    const go = () => { document.removeEventListener("keydown", onKey); if (!fb.isConnected || !isCurrent()) return; fb.remove(); next(); };
    const onKey = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } };
    const fb = h("div", { class: "feedback " + (res.correct ? "ok" : "bad"), onclick: (e) => { if (e.target === fb) go(); } },
      h("div", { class: "fb-head" }, eagle(res.correct ? "cheer" : "sad", 56), h("h3", {}, res.correct ? praise[Math.floor(Math.random() * praise.length)] : "Noch nicht – kommt gleich nochmal")),
      h("div", { class: "exp" }, p.ceb), h("div", { class: "pron" }, pronounce(p.ceb)), h("div", { class: "note" }, p.de),
      !res.correct && p.note ? h("div", { class: "note" }, "💡 " + p.note) : null,
      h("button", { class: "btn-primary btn-block btn-big mt", onclick: go }, "Weiter"));
    document.body.append(fb);
    document.addEventListener("keydown", onKey);
    fb.querySelector("button")?.focus();
  }

  async function renderSummary() {
    document.body.classList.remove("lesson-mode");
    const ids = Object.keys(results);
    const wobbly = ids.filter((k) => results[k].wrong > 0);
    await store.completePhraseRound({ collection: id, size: ids.length, correct: ids.length - wobbly.length, wrong: wobbly.length, dur: activeMs });
    if (!isCurrent()) return;
    const sc = phraseScores();
    const nowSicher = ids.filter((k) => statusOf(sc.get(k)) === "sicher").length;
    replace(main,
      h("div", { class: "mascot-center" }, eagle(wobbly.length === 0 ? "cheer" : "wave", 130)),
      h("h1", { class: "center", style: { marginTop: 0 } }, wobbly.length === 0 ? "Alle Sätze richtig!" : "Runde fertig"),
      h("p", { class: "center muted" }, `+${XP.trainerBonus} XP · zählt für den Streak 🔥`),
      h("div", { class: "stat-grid" },
        h("div", { class: "stat" }, h("b", { style: { color: "var(--ok)" } }, ids.length - wobbly.length), h("span", {}, "richtig")),
        h("div", { class: "stat" }, h("b", { style: { color: "var(--bad)" } }, wobbly.length), h("span", {}, "wackelig")),
        h("div", { class: "stat" }, h("b", {}, nowSicher), h("span", {}, "jetzt sicher")),
      ),
      h("div", { class: "card vocab-list mt" }, h("h3", { style: { marginTop: 0 } }, "Die Sätze dieser Runde"),
        ids.map((k) => { const p = byId(k); return h("div", { class: "v", style: { flexDirection: "column", gap: "2px" } }, h("b", {}, (results[k].wrong ? "🟡 " : "✅ ") + p.ceb), h("span", { class: "muted" }, p.de)); })),
      h("button", { class: "btn-primary btn-block btn-big mt", onclick: () => mountPhraseTrain(main, { content, id, onExit, isCurrent }) }, "Noch eine Runde"),
      h("button", { class: "btn-block mt", onclick: () => exit("#phrases") }, "Zur Übersicht"),
    );
    main.scrollTop = 0;
    if (wobbly.length === 0) confetti(50);
    document.dispatchEvent(new CustomEvent("trainer-complete"));
  }

  render();
  return { pause: () => exit() };
}
