// Lektions-Player: Übungen der Reihe nach, Fehler kommen ans Ende, Fortschritt wird gespeichert.
import { h, esc, shuffle, toast, confirmSheet, replace, copyText } from "./ui.js";
import { eagle, confetti } from "./art.js";
import { pronounce } from "./pronounce.js";
import { isAnswerAcceptable, normalizeAnswer } from "./answer.js";
import { weightFor, isDue } from "./srs.js";
import { db } from "./db.js";
import { store } from "./store.js";

const TYPE_LABEL = {
  multiple_choice: "Wähle die richtige Übersetzung",
  word_bank: "Baue den Satz aus den Kacheln",
  fill_blank: "Fülle die Lücke",
  type_answer: "Tippe die Übersetzung auf Cebuano",
  match_pairs: "Verbinde die Paare",
  true_false: "Stimmt die Übersetzung?",
};

export async function mountLesson(main, lessonId, { content, onExit, navigate, isCurrent = () => true }) {
  const lesson = content.lesson(lessonId);
  if (!lesson) { replace(main, h("p", {}, "Lektion nicht gefunden.")); return; }

  // ---- Zustand (ggf. fortsetzen) ----
  let st = await db.kvGet("lesson.inprogress");
  if (!isCurrent()) return;
  // Gespeicherter Stand passt nicht mehr zum Inhalt (Übungen geändert)? Dann neu anfangen.
  if (st && st.lessonId === lessonId && !(Array.isArray(st.queue) && st.queue.every((i) => Number.isInteger(i) && i < lesson.exercises.length))) {
    st = null;
    await db.kvDel("lesson.inprogress");
  }
  if (st && st.lessonId !== lessonId && st.pos >= 0) {
    const other = content.lesson(st.lessonId);
    const keep = other && !(await confirmSheet(`Du hast „${other.title}“ angefangen. Diese Lektion verwerfen und „${lesson.title}“ starten?`, { okLabel: "Verwerfen und starten", cancelLabel: "Zurück zur angefangenen" }));
    if (!isCurrent()) return;
    if (keep) { onExit("#lesson/" + st.lessonId); return; }
  }
  document.body.classList.add("lesson-mode");
  main.classList.add("nobounce");
  if (!st || st.lessonId !== lessonId) {
    st = {
      lessonId, queue: lesson.exercises.map((_, i) => i), pos: -1, xp: 0, correct: 0, total: 0,
      startedAt: Date.now(), attempted: {}, activeMs: 0,
    };
  }
  const realCount = lesson.exercises.filter((e) => e.type !== "grammar_note").length;
  const wasCompleted = store.progress.get(lessonId)?.completed;
  let exStart = Date.now();
  let keyHandler = null;

  const save = () => db.kvSet("lesson.inprogress", st);
  // Aussprache-Zeile; nur für Cebuano-Text (mehr bekannte als unbekannte Wörter)
  const isCeb = (t) => { const r = content.lexicon.analyze(t); return r.found.size > 0 && r.found.size >= r.unknown.length; };
  const pron = (t, cls = "pron") => (t && !t.includes("=") && isCeb(t) ? h("div", { class: cls }, pronounce(t)) : null);

  function exit(hash) {
    document.body.classList.remove("lesson-mode");
    main.classList.remove("nobounce");
    if (keyHandler) document.removeEventListener("keydown", keyHandler);
    onExit(hash);
  }

  async function pause() {
    if (st.pos < 0) { await db.kvDel("lesson.inprogress"); return exit(); }
    await save();
    toast("Lektion gespeichert – du kannst später weitermachen.");
    exit();
  }

  function header() {
    const done = Math.max(0, st.pos);
    const pct = Math.min(100, Math.round((done / st.queue.length) * 100));
    const answered = st.queue.slice(0, Math.max(0, st.pos)).filter((i) => lesson.exercises[i].type !== "grammar_note").length;
    const remaining = st.queue.slice(Math.max(0, st.pos)).filter((i) => lesson.exercises[i].type !== "grammar_note").length;
    return h("div", { class: "lesson-top" },
      h("button", { class: "btn-ghost btn-small", onclick: pause, "aria-label": "Pause" }, "✕"),
      h("div", { class: "progress", title: `${remaining} übrig` }, h("i", { style: { width: pct + "%" } })),
      h("div", { class: "xp" }, h("div", {}, `${st.xp} XP`), h("div", { class: "small muted", style: { fontWeight: 400 } }, `${answered}/${answered + remaining}`)),
    );
  }

  // ---- Intro: Vokabeln + Grammatik ----
  function renderIntro() {
    const vocab = h("div", { class: "card vocab-list" },
      h("h3", { style: { marginTop: 0 } }, "Neue Wörter"),
      lesson.vocab.map((v) => h("div", { class: "v" },
        h("div", {}, h("b", {}, v.ceb), h("span", { class: "pron" }, pronounce(v.ceb)), v.note ? h("span", { class: "note" }, v.note) : null),
        h("div", { class: "muted", style: { textAlign: "right" } }, v.de, v.outlook ? h("span", { class: "badge", style: { marginLeft: "6px" } }, "Ausblick") : null),
      )),
    );
    const start = () => { st.pos = 0; exStart = Date.now(); save(); renderCurrent(); };
    replace(main,
      header(),
      h("h1", {}, lesson.title),
      h("p", { class: "muted" }, `Unit ${lesson.unit} · Lektion ${lesson.posInUnit} · ${realCount} Übungen${wasCompleted ? " · schon geschafft, Wiederholung" : ""}`),
      vocab,
      h("div", { class: "grammar" }, h("h3", {}, lesson.grammar.title), h("p", { html: esc(lesson.grammar.text).replace(/\n/g, "<br>") })),
      h("button", { class: "btn-primary btn-block btn-big mt", onclick: start }, "Los geht's"),
    );
    main.scrollTop = 0;
    if (wasCompleted) main.querySelector("h1").after(h("button", { class: "btn-outline btn-block btn-small", onclick: start }, "Direkt zu den Übungen"));
  }

  function renderCurrent() {
    if (st.pos >= st.queue.length) return renderDone();
    const idx = st.queue[st.pos];
    const ex = lesson.exercises[idx];
    exStart = Date.now();
    main.scrollTop = 0;
    const body = h("div", {});
    replace(main, header(), body);
    let answered = false; // Schutz gegen Doppeltipp
    const ctx = { ex, idx, body, done: (res) => {
      if (answered || !isCurrent()) return;
      answered = true;
      body.querySelectorAll("button, input").forEach((b) => { b.disabled = true; });
      finish(ex, idx, res);
    } };
    const renderers = { multiple_choice, word_bank, fill_blank, type_answer, match_pairs, true_false, grammar_note };
    renderers[ex.type](ctx);
  }

  // res: {correct, near, expected, note?}
  async function finish(ex, idx, res) {
    const dur = Date.now() - exStart;
    st.activeMs += Math.min(dur, 120000);
    if (ex.type === "grammar_note") {
      st.pos++;
      await save();
      return renderCurrent();
    }
    const firstTry = !st.attempted[idx];
    st.attempted[idx] = (st.attempted[idx] || 0) + 1;
    const words = content.exerciseWords(ex);
    const due = words.some((w) => isDue(store.words.get(w)));
    const xp = await store.recordAnswer({
      lesson: lessonId, mode: "lesson", exType: ex.type, words, correct: res.correct, near: res.near,
      dur, weight: weightFor(ex.type, "lesson"), firstTry, due,
    });
    st.xp += xp;
    st.total++;
    if (res.correct) st.correct++;
    else st.queue.push(idx); // ans Ende anhängen
    st.pos++;
    await save();
    showFeedback(res, words, () => renderCurrent());
  }

  function showFeedback(res, words, next) {
    const cls = !res.correct ? "bad" : res.near ? "near" : "ok";
    const title = !res.correct ? "Leider falsch" : res.near ? "Fast – richtig wäre:" : "Richtig!";
    // Bei Fehlern die beteiligten Wörter erklären
    const explain = !res.correct || res.near
      ? words.map((w) => content.entry(w)).filter(Boolean).slice(0, 4).map((e) => h("div", { class: "small" }, h("b", {}, e.ceb), h("span", { class: "pron inline" }, pronounce(e.ceb)), " = ", e.de, e.note ? h("span", { class: "muted" }, ` (${e.note})`) : null))
      : [];
    const go = () => {
      document.removeEventListener("keydown", keyHandler); keyHandler = null;
      if (!fb.isConnected || !isCurrent()) return; // Screen wurde inzwischen verlassen
      fb.remove();
      next();
    };
    const fb = h("div", { class: "feedback " + cls, onclick: (e) => { if (e.target === fb) go(); } },
      h("div", { class: "fb-head" }, eagle(!res.correct ? "sad" : res.near ? "think" : "cheer", 56), h("h3", {}, title)),
      (res.near || !res.correct) ? h("div", { class: "exp" }, res.expected) : null,
      (res.near || !res.correct) ? pron(res.expected) : null,
      res.note ? h("div", { class: "note" }, res.note) : null,
      explain.length ? h("div", { class: "mt" }, explain) : null,
      h("button", { class: "btn-primary btn-block btn-big mt", onclick: go }, "Weiter"),
    );
    document.body.append(fb);
    keyHandler = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } };
    document.addEventListener("keydown", keyHandler);
    document.querySelector(".feedback button")?.focus();
  }

  const dontKnow = (expected, fn) => h("button", { class: "btn-ghost btn-block btn-small", onclick: () => fn({ correct: false, near: false, expected }) }, "Weiß ich nicht – Lösung zeigen");

  // ---------- Übungstypen ----------
  function multiple_choice({ ex, body, done }) {
    let sel = null;
    const opts = ex.options.map((o, i) => h("button", { class: "opt", onclick: () => { sel = i; opts.forEach((b, j) => b.classList.toggle("sel", j === i)); check.disabled = false; } }, o));
    const check = h("button", { class: "btn-primary btn-block btn-big mt", disabled: true, onclick: () => {
      const ok = sel === ex.answer;
      opts[ex.answer].classList.add("ok");
      if (!ok) opts[sel].classList.add("bad");
      done({ correct: ok, near: false, expected: ex.options[ex.answer] });
    } }, "Prüfen");
    body.append(
      h("div", { class: "hint" }, TYPE_LABEL.multiple_choice),
      h("div", { class: "prompt" }, ex.prompt),
      ex.direction === "ceb_de" ? pron(ex.prompt, "pron under") : null,
      h("div", { class: "options" }, opts),
      check,
    );
  }

  function word_bank({ ex, body, done }) {
    const tokens = shuffle(ex.tokens.map((t, i) => ({ t, i })));
    const chosen = []; // indices in tokens
    const answerBox = h("div", { class: "bank answer" });
    const bankBox = h("div", { class: "bank" });
    const tiles = tokens.map((tk, k) => h("button", { class: "tile", onclick: () => { if (chosen.includes(k)) return; chosen.push(k); render(); } }, tk.t));
    const check = h("button", { class: "btn-primary btn-block btn-big mt", disabled: true, onclick: () => {
      const got = chosen.map((k) => tokens[k].t).join(" ");
      const targets = [ex.answer.join(" "), ...(ex.accepted || [])];
      const n = normalizeAnswer(got);
      const ok = targets.some((t) => normalizeAnswer(t) === n);
      if (!ok) answerBox.classList.add("bad");
      done({ correct: ok, near: false, expected: ex.answer.join(" ") });
    } }, "Prüfen");
    const reset = h("button", { class: "btn-ghost btn-small", onclick: () => { chosen.length = 0; render(); } }, "Zurücksetzen");
    function render() {
      replace(answerBox, ...chosen.map((k, pos) => h("button", { class: "tile", onclick: () => { chosen.splice(pos, 1); render(); } }, tokens[k].t)));
      tiles.forEach((b, k) => b.classList.toggle("used", chosen.includes(k)));
      check.disabled = chosen.length === 0;
      reset.classList.toggle("hidden", chosen.length === 0);
    }
    bankBox.append(...tiles);
    body.append(h("div", { class: "hint" }, TYPE_LABEL.word_bank), h("div", { class: "prompt" }, ex.prompt), ex.direction === "ceb_de" ? pron(ex.prompt, "pron under") : null, answerBox, bankBox, h("div", { class: "row spread mt" }, reset), check, dontKnow(ex.answer.join(" "), done));
    render();
  }

  function fill_blank({ ex, body, done }) {
    let sel = null;
    const promptEl = h("div", { class: "prompt" });
    const renderPrompt = () => { promptEl.innerHTML = esc(ex.prompt).replace("___", `<u>${sel == null ? "____" : esc(ex.options[sel])}</u>`); };
    const opts = ex.options.map((o, i) => h("button", { class: "opt", onclick: () => { sel = i; opts.forEach((b, j) => b.classList.toggle("sel", j === i)); renderPrompt(); check.disabled = false; } }, o));
    const check = h("button", { class: "btn-primary btn-block btn-big mt", disabled: true, onclick: () => {
      const ok = sel === ex.answer;
      opts[ex.answer].classList.add("ok");
      if (!ok) opts[sel].classList.add("bad");
      done({ correct: ok, near: false, expected: ex.prompt.replace("___", ex.options[ex.answer]) });
    } }, "Prüfen");
    renderPrompt();
    body.append(h("div", { class: "hint" }, TYPE_LABEL.fill_blank), promptEl, h("div", { class: "pron under" }, pronounce(ex.prompt.replace("___", "…"))), h("p", { class: "muted" }, ex.translation), h("div", { class: "options" }, opts), check);
  }

  function type_answer({ ex, body, done }) {
    const input = h("input", { type: "text", autocomplete: "off", autocorrect: "off", autocapitalize: "off", spellcheck: "false", placeholder: "Auf Cebuano …", enterkeyhint: "done" });
    const submit = () => {
      if (!input.value.trim()) return;
      const r = isAnswerAcceptable(input.value, ex.answer, ex.accepted);
      input.blur();
      done({ correct: r.ok, near: r.near, expected: r.expected });
    };
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") submit(); });
    body.append(h("div", { class: "hint" }, TYPE_LABEL.type_answer), h("div", { class: "prompt" }, ex.prompt), input,
      h("button", { class: "btn-primary btn-block btn-big mt", onclick: submit }, "Prüfen"),
      dontKnow(ex.answer, (r) => { input.blur(); done(r); }),
      h("div", { class: "kbd-space" }));
    setTimeout(() => input.focus(), 50);
  }

  function match_pairs({ ex, body, done }) {
    const left = shuffle(ex.pairs.map((p, i) => ({ text: p.ceb, i })));
    const right = shuffle(ex.pairs.map((p, i) => ({ text: p.de, i })));
    let selL = null, selR = null, matched = 0, wrongTaps = 0;
    const lBtns = left.map((o) => h("button", { class: "opt", onclick: () => pick("L", o) }, o.text));
    const rBtns = right.map((o) => h("button", { class: "opt", onclick: () => pick("R", o) }, o.text));
    const btnOf = (side, o) => (side === "L" ? lBtns[left.indexOf(o)] : rBtns[right.indexOf(o)]);
    function pick(side, o) {
      const btn = btnOf(side, o);
      if (btn.classList.contains("matched")) return;
      if (side === "L") { selL = o; lBtns.forEach((b) => b.classList.toggle("sel", b === btn)); }
      else { selR = o; rBtns.forEach((b) => b.classList.toggle("sel", b === btn)); }
      if (selL && selR) {
        const a = btnOf("L", selL), b = btnOf("R", selR);
        if (selL.i === selR.i) {
          a.classList.add("matched"); b.classList.add("matched"); matched++;
        } else {
          wrongTaps++;
          a.classList.add("bad"); b.classList.add("bad");
          setTimeout(() => { a.classList.remove("bad"); b.classList.remove("bad"); }, 500);
        }
        a.classList.remove("sel"); b.classList.remove("sel");
        selL = selR = null;
        if (matched === ex.pairs.length) {
          setTimeout(() => done({ correct: wrongTaps <= 1, near: wrongTaps === 1, expected: ex.pairs.map((p) => `${p.ceb} = ${p.de}`).join(", "), note: wrongTaps ? `${wrongTaps} Fehlversuch(e)` : null }), 300);
        }
      }
    }
    const grid = h("div", { class: "pairs" });
    for (let i = 0; i < ex.pairs.length; i++) grid.append(lBtns[i], rBtns[i]);
    body.append(h("div", { class: "hint" }, TYPE_LABEL.match_pairs), grid);
  }

  function true_false({ ex, body, done }) {
    const answer = (v) => done({ correct: v === ex.answer, near: false, expected: ex.answer ? `${ex.statement} = ${ex.translation}` : `${ex.statement} = ${ex.correction}`, note: ex.answer ? null : `„${ex.translation}“ war falsch.` });
    body.append(
      h("div", { class: "hint" }, TYPE_LABEL.true_false),
      h("div", { class: "prompt" }, ex.statement),
      h("div", { class: "pron under" }, pronounce(ex.statement)),
      h("div", { class: "prompt small muted" }, "= " + ex.translation + " ?"),
      h("div", { class: "row mt" },
        h("button", { class: "grow btn-big", onclick: () => answer(true) }, "Stimmt"),
        h("button", { class: "grow btn-big", onclick: () => answer(false) }, "Stimmt nicht"),
      ),
    );
  }

  function grammar_note({ ex, body, done }) {
    body.append(
      h("div", { class: "grammar" }, h("h3", {}, ex.title), h("p", { html: esc(ex.text).replace(/\n/g, "<br>") })),
      h("button", { class: "btn-primary btn-block btn-big mt", onclick: () => done({}) }, "Weiter"),
    );
  }

  // ---------- Abschluss ----------
  async function renderDone() {
    const dur = st.activeMs || (Date.now() - st.startedAt);
    const acc = st.total ? Math.round((st.correct / st.total) * 100) : 0;
    await store.completeLesson({ lesson: lessonId, dur, xp: st.xp, correct: st.correct, total: st.total });
    await db.kvDel("lesson.inprogress");
    const s = lesson.surprise;
    const nextLesson = content.lessons[lesson.index + 1] || null;
    const stats = store.progress.get(lessonId);
    const unitLessons = content.lessons.filter((x) => x.unit === lesson.unit);
    const unitDone = unitLessons.every((x) => store.progress.get(x.id)?.completed) && lesson.posInUnit === unitLessons.length;
    replace(main,
      h("div", { class: "mascot-center" }, eagle(acc >= 70 ? "cheer" : "wave", 150)),
      h("h1", { class: "center", style: { marginTop: 0 } }, acc >= 90 ? "Stark!" : acc >= 70 ? "Lektion geschafft!" : "Geschafft – dranbleiben!"),
      unitDone ? h("p", { class: "center" }, `🏅 Unit ${lesson.unit} komplett – Abzeichen verdient!`) : null,
      h("div", { class: "result-big" }, `${st.xp + 20} XP`),
      h("div", { class: "stat-grid" },
        h("div", { class: "stat" }, h("b", {}, acc + " %"), h("span", {}, stats && stats.attempts > 1 ? `Quote (beste ${stats.bestAccuracy} %)` : "Trefferquote")),
        h("div", { class: "stat" }, h("b", {}, Math.max(1, Math.round(dur / 60000)) + " min"), h("span", {}, "Dauer")),
        h("div", { class: "stat" }, h("b", {}, lesson.vocab.length), h("span", {}, "neue Wörter")),
      ),
      h("h2", {}, "Überraschungssatz für deine Frau"),
      h("div", { class: "surprise" }, h("div", { class: "ceb" }, s.ceb), h("div", { class: "pron" }, pronounce(s.ceb)), h("div", { class: "de" }, s.de), h("div", { class: "when" }, "Wann: " + s.when),
        h("button", { class: "btn-ghost btn-small mt", onclick: () => copyText(s.ceb) }, "Satz kopieren")),
      nextLesson ? h("button", { class: "btn-primary btn-block btn-big mt", onclick: () => exit("#lesson/" + nextLesson.id) }, `Weiter: ${nextLesson.title}`) : null,
      h("div", { class: "row mt" },
        h("button", { class: "grow", onclick: () => exit("#path") }, nextLesson ? "Zum Pfad" : "Fertig"),
        acc < 100 ? h("button", { class: "grow btn-outline", onclick: () => exit("#lesson/" + lessonId) }, "Nochmal üben") : null,
      ),
    );
    main.scrollTop = 0;
    if (acc >= 70) confetti(unitDone ? 140 : 70);
    document.dispatchEvent(new CustomEvent("lesson-complete", { detail: { lessonId } }));
  }

  if (st.pos < 0) renderIntro();
  else renderCurrent();
  return { pause };
}

export async function hasLessonInProgress() {
  return db.kvGet("lesson.inprogress");
}
export async function discardLessonInProgress() {
  return db.kvDel("lesson.inprogress");
}
