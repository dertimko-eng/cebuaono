// Geschichten-Player: Comic-Dialog mit Figuren, Übersetzung auf Tipp, Verständnisfragen.
import { h, replace, shuffle } from "./ui.js";
import { eagle, confetti } from "./art.js";
import { pronounce } from "./pronounce.js";
import { sceneSvg } from "./scenes.js";
import { portrait, characterName } from "./characters.js";
import { store } from "./store.js";

export async function mountStory(main, storyId, { content, onExit, isCurrent = () => true }) {
  const story = content.story(storyId);
  if (!story) { replace(main, h("p", {}, "Geschichte nicht gefunden.")); return; }
  const done = await store.storiesDone();
  if (!isCurrent()) return;
  let wasDone = done.includes(story.id);
  let shown = 0;
  let showAll = false;
  const answers = [];

  const exit = (hash) => { document.onkeydown = null; document.body.classList.remove("lesson-mode"); onExit(hash); };
  const scene = () => h("div", { class: "scene", html: sceneSvg(story.scene) });
  const top = (label) => h("div", { class: "lesson-top" },
    h("button", { class: "btn-ghost btn-icon", onclick: () => exit(), "aria-label": "Schließen" }, "✕"),
    h("div", { class: "grow small muted" }, label),
  );

  function renderIntro() {
    document.body.classList.add("lesson-mode");
    replace(main,
      top(`Geschichte · Unit ${story.unit}`),
      scene(),
      h("h1", {}, story.title),
      h("p", { class: "muted" }, story.intro),
      h("div", { class: "cast" }, [...new Set(story.lines.map((l) => l.who))].map((w) => h("div", { class: "cast-item" }, portrait(w, 40), h("span", {}, characterName(w))))),
      h("p", { class: "small muted" }, "Tipp auf eine Sprechblase zeigt die Übersetzung. Lies erst auf Cebuano, rate mit, dann prüfe."),
      h("button", { class: "btn-primary btn-block btn-big mt", onclick: () => { shown = 1; renderLines(); } }, wasDone ? "Nochmal lesen" : "Los geht's"),
    );
    main.scrollTop = 0;
  }

  function bubble(line, i) {
    let open = showAll;
    const de = h("div", { class: "bubble-de" + (open ? "" : " hidden") }, line.de);
    const b = h("div", { class: "story-line " + (line.who === "tim" ? "me" : "") + (i === shown - 1 ? " new" : "") },
      portrait(line.who, 40),
      h("div", { class: "story-bubble", role: "button", tabindex: "0", "aria-label": "Übersetzung zeigen", onclick: () => { open = !open; de.classList.toggle("hidden", !open); }, onkeydown: (ev) => { if (ev.key === " ") { ev.preventDefault(); ev.currentTarget.click(); } } },
        h("div", { class: "who" }, characterName(line.who)),
        h("div", { class: "ceb" }, line.ceb),
        h("div", { class: "pron" }, pronounce(line.ceb)),
        de,
      ),
    );
    return b;
  }

  function renderLines() {
    if (!isCurrent()) { document.onkeydown = null; return; }
    const lines = story.lines.slice(0, shown).map(bubble);
    const atEnd = shown >= story.lines.length;
    const next = h("button", { class: "btn-primary btn-block btn-big mt", onclick: () => { if (atEnd) return renderQuestion(0); shown++; renderLines(); } }, atEnd ? "Zu den Fragen" : "Weiter");
    replace(main,
      top(`${shown}/${story.lines.length}`),
      scene(),
      h("div", { class: "story" }, lines),
      h("div", { class: "row spread mt" },
        h("button", { class: "btn-ghost btn-small", onclick: () => { showAll = !showAll; renderLines(); } }, showAll ? "Übersetzungen verstecken" : "Alle Übersetzungen zeigen"),
      ),
      next,
    );
    const last = main.querySelector(".story-line.new");
    if (last) last.scrollIntoView({ block: "end", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    document.onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); next.click(); } };
  }

  function renderQuestion(qi) {
    document.onkeydown = null;
    const q = story.questions[qi];
    if (!q) return renderDone();
    let answered = false;
    const opts = q.options.map((o, i) => h("button", { class: "opt", onclick: () => {
      if (answered) return;
      answered = true;
      const ok = i === q.answer;
      answers.push(ok);
      opts[q.answer].classList.add("ok");
      if (!ok) opts[i].classList.add("bad");
      opts.forEach((b) => (b.disabled = true));
      main.append(h("button", { class: "btn-primary btn-block btn-big mt", onclick: () => renderQuestion(qi + 1) }, qi + 1 < story.questions.length ? "Nächste Frage" : "Zum Ende"));
    } }, o));
    replace(main,
      top(`Frage ${qi + 1}/${story.questions.length}`),
      h("div", { class: "hint" }, "Hast du die Geschichte verstanden?"),
      h("div", { class: "prompt" }, q.q),
      h("div", { class: "options" }, opts),
    );
    main.scrollTop = 0;
  }

  async function renderDone() {
    const correct = answers.filter(Boolean).length;
    const first = !wasDone && (await store.completeStory(story.id, correct, story.questions.length));
    if (!isCurrent()) return;
    const nextUnit = content.units.find((u) => u.unit === story.unit + 1);
    replace(main,
      h("div", { class: "mascot-center" }, eagle(correct === story.questions.length ? "cheer" : "wave", 130)),
      h("h1", { class: "center", style: { marginTop: 0 } }, correct === story.questions.length ? "Alles verstanden!" : `${correct} von ${story.questions.length} richtig`),
      h("div", { class: "card punchline" }, h("div", { class: "small muted" }, "Pointe"), h("p", { style: { fontSize: "18px", margin: "6px 0 0" } }, story.punchline)),
      first ? h("p", { class: "center muted" }, "+15 XP für die Geschichte") : null,
      h("button", { class: "btn-primary btn-block btn-big mt", onclick: () => exit("#path") }, nextUnit ? `Weiter im Pfad: Unit ${nextUnit.unit}` : "Zum Pfad"),
      h("button", { class: "btn-block mt", onclick: () => { shown = 1; showAll = true; answers.length = 0; renderLines(); } }, "Nochmal mit Übersetzungen lesen"),
    );
    main.scrollTop = 0;
    if (correct === story.questions.length) confetti(50);
    wasDone = true;
  }

  renderIntro();
  return { pause: () => exit() };
}
