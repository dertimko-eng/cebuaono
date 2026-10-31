// Fortschritt & Statistik – alles aus dem Ereignis-Log berechnet.
import { h, esc, fmtMinutes, replace } from "./ui.js";
import { computeStats, fmtDate } from "./stats.js";
import { lineChart, stackedBar, stackedArea, heatmap, barList } from "./charts.js";
import { store } from "./store.js";

const TYPE_NAMES = {
  multiple_choice: "Multiple Choice", word_bank: "Satz bauen", fill_blank: "Lückentext", type_answer: "Tippen",
  match_pairs: "Paare", true_false: "Richtig/Falsch", trainer_easy: "Trainer einfach", trainer_hard: "Trainer schwer", lesson: "Lektion",
};
const C = { neu: "var(--c1)", lernend: "var(--c2)", gefestigt: "var(--c3)", gemeistert: "var(--c4)" };

export function getStats(content) {
  return computeStats({ events: store.events, words: store.wordList(), progress: [...store.progress.values()], content, settings: store.settings, srsHistory: store.srsHistory });
}

export function renderProgress(main, { content, navigate }) {
  const s = getStats(content);
  const card = (title, ...kids) => h("div", { class: "card" }, title ? h("h3", { style: { marginTop: 0 } }, title) : null, ...kids);
  const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
  const trendArrow = { up: "▲", down: "▼", flat: "▶" }[s.trend];
  const unitRows = content.units.map((u) => ({ label: `Unit ${u.unit}`, value: s.accuracy.byUnit[u.unit]?.pct ?? null }));
  const typeRows = Object.entries(s.accuracy.byType).filter(([k]) => TYPE_NAMES[k]).map(([k, v]) => ({ label: TYPE_NAMES[k], value: v.pct, text: v.pct == null ? "–" : `${v.pct} % (${v.n})` }));
  const lessonRows = content.lessons.filter((l) => s.accuracy.byLesson[l.id]).map((l) => ({ label: `${l.unit}.${l.posInUnit} ${l.title}`, value: s.accuracy.byLesson[l.id].pct }));

  replace(main, 
    h("h1", {}, "Fortschritt"),

    card("Gesamt",
      h("div", { class: "stat-grid" },
        h("div", { class: "stat" }, h("b", {}, s.learnedWords), h("span", {}, `von ${s.totalWords} Wörtern`)),
        h("div", { class: "stat" }, h("b", {}, s.completedLessons), h("span", {}, `von ${s.totalLessons} Lektionen`)),
        h("div", { class: "stat" }, h("b", {}, s.level), h("span", {}, "Niveau")),
      ),
      h("div", { class: "progress mt" }, h("i", { style: { width: pct(s.completedLessons, s.totalLessons) + "%" } })),
      h("p", { class: "small muted" }, s.nextLevel ? `${s.nextLevel.level} erreichst du nach Unit ${s.nextLevel.unit - 1} (du hast ${s.highestUnitDone} Units abgeschlossen).` : "A2 erreicht – Kurs abgeschlossen!"),
    ),

    card("Wortschatz-Stufen",
      h("div", { html: stackedBar(["neu", "lernend", "gefestigt", "gemeistert"].map((k) => ({ label: k, value: s.srsDist[k], color: C[k] }))) }),
      h("p", { class: "small muted mt" }, "Verlauf der letzten 30 Tage"),
      h("div", { html: stackedArea(s.srsSeries, ["lernend", "gefestigt", "gemeistert"], [C.lernend, C.gefestigt, C.gemeistert], ["lernend", "gefestigt", "gemeistert"]) }),
    ),

    card("Trefferquote",
      h("div", { class: "row spread" }, h("span", {}, "Gesamt"), h("b", { class: "big-num" }, s.accuracy.overall == null ? "–" : s.accuracy.overall + " %")),
      h("p", { class: "small muted" }, `${s.answersTotal} beantwortete Übungen`),
      h("h3", {}, "Nach Übungstyp"),
      typeRows.length ? h("div", { html: barList(typeRows) }) : h("p", { class: "muted small" }, "Noch keine Daten."),
      h("h3", {}, "Nach Unit"),
      h("div", { html: barList(unitRows.filter((r) => r.value != null)) }),
      lessonRows.length ? h("details", {}, h("summary", { class: "muted small", style: { cursor: "pointer", padding: "6px 0" } }, "Nach Lektion anzeigen"), h("div", { html: barList(lessonRows) })) : null,
    ),

    card("Verbesserung",
      h("p", { class: "small muted" }, "Trefferquote und Behaltensquote (fällige Wiederholungen beim ersten Versuch richtig) pro Woche"),
      h("div", { html: lineChart([
        { label: "Trefferquote", values: s.weekly.map((w) => w.accuracy), color: "var(--c3)" },
        { label: "Behaltensquote", values: s.weekly.map((w) => w.retention), color: "var(--c4)" },
      ], s.weekly.map((w) => w.label), { yMax: 100, unit: "%" }) }),
    ),

    card("Schwierigste Wörter",
      s.hardest.length
        ? h("div", { class: "vocab-list" }, s.hardest.map((w) => h("div", { class: "v" }, h("div", {}, h("b", {}, w.ceb), h("span", { class: "note" }, w.de)), h("span", { class: "muted small" }, `${w.wrong}× falsch · ${w.pct ?? 0} %`))))
        : h("p", { class: "muted small" }, "Noch keine Fehler – weiter so."),
      s.hardest.length ? h("button", { class: "btn-primary btn-block mt", onclick: () => navigate("#trainer/preset?words=" + encodeURIComponent(s.hardest.map((w) => w.ceb).join("|"))) }, "Diese Wörter jetzt üben") : null,
    ),

    card("Zeit",
      h("div", { class: "stat-grid" },
        h("div", { class: "stat" }, h("b", {}, fmtMinutes(s.time.today)), h("span", {}, "heute")),
        h("div", { class: "stat" }, h("b", {}, fmtMinutes(s.time.week)), h("span", {}, "diese Woche")),
        h("div", { class: "stat" }, h("b", {}, fmtMinutes(s.time.total)), h("span", {}, "gesamt")),
      ),
      h("p", { class: "small muted mt" }, s.time.avgLesson ? `Ø ${s.time.avgLesson} min pro Lektion` : "Noch keine Lektion abgeschlossen."),
      h("div", { html: lineChart([{ label: "Minuten", values: s.weekly.map((w) => w.minutes), color: "var(--accent)" }], s.weekly.map((w) => w.label), { unit: "" }) }),
    ),

    card("Konstanz",
      h("div", { class: "stat-grid" },
        h("div", { class: "stat" }, h("b", {}, s.streak + " 🔥"), h("span", {}, "aktueller Streak")),
        h("div", { class: "stat" }, h("b", {}, s.longest), h("span", {}, "längster Streak")),
        h("div", { class: "stat" }, h("b", {}, s.heatmap.filter((d) => d.active).length), h("span", {}, "aktive Tage (12 Wo.)")),
      ),
      h("div", { class: "mt", html: heatmap(s.heatmap) }),
    ),

    card("Tempo",
      h("div", { class: "row spread" },
        h("div", {}, h("div", { class: "big-num" }, s.wordsThisWeek, " ", h("span", { class: "trend-" + s.trend, style: { fontSize: "20px" } }, trendArrow)), h("div", { class: "small muted" }, `neue Wörter diese Woche (Vorwoche: ${s.wordsLastWeek})`)),
      ),
      h("div", { html: lineChart([{ label: "neue Wörter", values: s.weekly.map((w) => w.newWords), color: "var(--c2)" }], s.weekly.map((w) => w.label)) }),
      h("p", { class: "mt" }, s.projection
        ? `Bei diesem Tempo (Ø ${s.projection.rate} Wörter/Woche) bist du am ${fmtDate(s.projection.date)} bei A2 – in etwa ${s.projection.weeks} Wochen.`
        : s.learnedWords >= s.totalWords ? "Alle Wörter gelernt!" : "Lerne ein paar Wochen, dann erscheint hier eine Hochrechnung bis A2."),
    ),
  );
  main.scrollTop = 0;
}

export function weeklyReviewText(content) {
  const s = getStats(content);
  const r = s.weeklyReview;
  if (!r.answers && !r.lessons) return null;
  return [
    `Letzte Woche (${r.from}–${r.to}) hast du ${r.lessons} Lektion${r.lessons === 1 ? "" : "en"} und ${r.rounds} Trainer-Runde${r.rounds === 1 ? "" : "n"} geschafft, an ${r.activeDays} Tag${r.activeDays === 1 ? "" : "en"} gelernt und ${fmtMinutes(r.minutes)} investiert.`,
    `Dabei hast du ${r.answers} Übungen beantwortet, davon ${r.accuracy ?? 0} % richtig, und ${r.newWords} neue Wörter gelernt.`,
    `Dein Streak steht bei ${s.streak} Tag${s.streak === 1 ? "" : "en"} – ${s.dueCount ? `${s.dueCount} Wörter warten auf Wiederholung.` : "nichts ist überfällig, perfekt."}`,
  ];
}
