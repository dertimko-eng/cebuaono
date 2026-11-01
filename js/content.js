// Lädt Glossar, Namen und Units und stellt Abfragen bereit. Die App ist nur ein Player dieser Daten.
import { Lexicon, normalizeToken } from "./lexicon.js";
import { setPronOverrides } from "./pronounce.js";

const LEVEL_AFTER = { 0: "A0", 1: "A0", 2: "A0", 3: "A0", 4: "A0", 5: "A1", 6: "A1", 7: "A1", 8: "A1", 9: "A2", 10: "A2", 11: "A2", 12: "A2" };

async function getJSON(path) {
  const r = await fetch(path, { cache: "no-cache" });
  if (!r.ok) throw new Error(`${path}: ${r.status}`);
  return r.json();
}

export async function loadContent() {
  const [index, glossary, namesFile] = await Promise.all([
    getJSON("content/index.json"),
    getJSON("content/glossary.json"),
    getJSON("content/names.json"),
  ]);
  const units = [];
  for (const u of index.units) {
    try {
      units.push(await getJSON(`content/units/${u}.json`));
    } catch (e) {
      console.warn("Unit fehlt:", u);
    }
  }
  units.sort((a, b) => a.unit - b.unit);
  const lexicon = new Lexicon(glossary, namesFile.names);
  setPronOverrides(glossary.entries);
  const lessons = [];
  const lessonById = new Map();
  for (const u of units) {
    u.lessons.forEach((l, i) => {
      const L = { ...l, unit: u.unit, unitTitle: u.title, index: lessons.length, posInUnit: i + 1 };
      lessons.push(L);
      lessonById.set(l.id, L);
    });
  }
  const entryByCeb = new Map(glossary.entries.map((e) => [normalizeToken(e.ceb), e]));

  const content = {
    units,
    lessons,
    glossary,
    lexicon,
    lesson: (id) => lessonById.get(id),
    entry: (ceb) => entryByCeb.get(normalizeToken(ceb)) || null,
    unitOf: (lessonId) => parseInt(String(lessonId).slice(1, 3)),
    levelAfterUnit: (n) => LEVEL_AFTER[Math.min(12, Math.max(0, n))] || "A0",
    // Nächste nicht abgeschlossene Lektion (Pfad ist linear)
    nextLessonId(completedSet) {
      for (const l of lessons) if (!completedSet.has(l.id)) return l.id;
      return null;
    },
    isUnlocked(lessonId, completedSet) {
      const l = lessonById.get(lessonId);
      if (!l) return false;
      if (l.index === 0) return true;
      return completedSet.has(lessons[l.index - 1].id);
    },
    surprises: () => lessons.map((l) => ({ ...l.surprise, lessonId: l.id, lessonTitle: l.title, unit: l.unit })),
    // Wörter, die in einer Übung trainiert werden (explizit oder automatisch erkannt)
    exerciseWords(ex) {
      if (ex.vocab && ex.vocab.length) return ex.vocab.map((c) => content.entry(c)).filter(Boolean).map((e) => e.ceb);
      const texts = [];
      switch (ex.type) {
        case "multiple_choice": texts.push(ex.direction === "ceb_de" ? ex.prompt : ex.options[ex.answer]); break;
        case "word_bank": texts.push((ex.direction || "de_ceb") === "de_ceb" ? ex.answer.join(" ") : ex.prompt); break;
        case "fill_blank": texts.push(ex.options[ex.answer]); break;
        case "type_answer": texts.push(ex.answer); break;
        case "match_pairs": texts.push(ex.pairs.map((p) => p.ceb).join(" ")); break;
        case "true_false": texts.push(ex.statement); break;
      }
      const set = new Set();
      for (const t of texts) {
        const { found } = lexicon.analyze(t);
        for (const e of found.keys()) set.add(e);
      }
      // Kurze Funktionswörter (ko, ka, ug, sa …) nur zählen, wenn die Übung sonst kein Wort trainiert
      const isFiller = (e) => ["particle", "prep", "conj", "pron"].includes(e.pos) && e.ceb.length <= 3;
      const content_ = [...set].filter((e) => !isFiller(e));
      return (content_.length ? content_ : [...set]).map((e) => e.ceb);
    },
    // Ablenker: gleiche Wortart, möglichst gleiche Unit; nie das Wort selbst
    distractors(entry, n, poolFilter = null) {
      let pool = glossary.entries.filter((e) => e !== entry && e.de !== entry.de && (!poolFilter || poolFilter(e)));
      const samePosUnit = pool.filter((e) => e.pos === entry.pos && e.lesson.slice(0, 3) === entry.lesson.slice(0, 3));
      const samePos = pool.filter((e) => e.pos === entry.pos);
      const pick = [];
      for (const src of [samePosUnit, samePos, pool]) {
        const cand = src.filter((e) => !pick.includes(e)).sort(() => Math.random() - 0.5);
        while (pick.length < n && cand.length) pick.push(cand.pop());
        if (pick.length >= n) break;
      }
      return pick;
    },
    // Glossar-Einträge, die bis einschließlich einer Lektion eingeführt sind
    entriesUpTo(lessonId) {
      const r = Lexicon.lessonRank(lessonId);
      return glossary.entries.filter((e) => Lexicon.lessonRank(e.lesson) <= r);
    },
  };
  return content;
}
