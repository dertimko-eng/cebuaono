#!/usr/bin/env node
// Prüft content/glossary.json und content/units/unit_NN.json gegen CONTENT_SPEC.md.
// Aufruf: node scripts/validate_content.mjs            (alle Units)
//         node scripts/validate_content.mjs 3          (nur Unit 3)
//         node scripts/validate_content.mjs --quiet    (nur Fehler)
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { Lexicon, tokenize, normalizeToken } from "../js/lexicon.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const args = process.argv.slice(2);
const quiet = args.includes("--quiet");
const onlyUnit = args.find((a) => /^\d+$/.test(a));

const glossary = JSON.parse(readFileSync(join(root, "content/glossary.json"), "utf8"));
const names = JSON.parse(readFileSync(join(root, "content/names.json"), "utf8")).names;
const index = JSON.parse(readFileSync(join(root, "content/index.json"), "utf8"));
const lex = new Lexicon(glossary, names);

const errors = [];
const warnings = [];
const err = (where, msg) => errors.push(`${where}: ${msg}`);
const warn = (where, msg) => warnings.push(`${where}: ${msg}`);

const EX_TYPES = ["multiple_choice", "word_bank", "fill_blank", "type_answer", "match_pairs", "true_false", "grammar_note"];
const BAD_SPELLING = { og: "ug", jud: "gyud", jd: "gyud", kanusa: "kanus-a", maguusa: "mag-usa", gyod: "gyud", gayod: "gyud", unsay2: "" };
const VALID_POS = new Set(["noun", "verb", "adj", "adv", "pron", "particle", "number", "phrase", "question", "prep", "conj", "name"]);

// ---------- Glossar ----------
const lessonOfWord = new Map();
const glossaryByLesson = new Map();
{
  const seen = new Set();
  for (const e of glossary.entries) {
    const key = normalizeToken(e.ceb);
    if (seen.has(key)) err("glossary", `doppeltes Wort ${e.ceb}`);
    seen.add(key);
    if (!e.de) err("glossary", `${e.ceb}: de fehlt`);
    if (!VALID_POS.has(e.pos)) err("glossary", `${e.ceb}: ungültiges pos ${e.pos}`);
    if (!/^u\d\d_l\d\d$/.test(e.lesson)) err("glossary", `${e.ceb}: ungültige lesson ${e.lesson}`);
    lessonOfWord.set(key, e.lesson);
    if (!glossaryByLesson.has(e.lesson)) glossaryByLesson.set(e.lesson, []);
    glossaryByLesson.get(e.lesson).push(e);
  }
}

// ---------- Units ----------
const unitFiles = onlyUnit ? [`unit_${String(onlyUnit).padStart(2, "0")}`] : index.units;
const allLessonIds = new Set();
let lessonCount = 0;

for (const uf of unitFiles) {
  const path = join(root, "content/units", uf + ".json");
  if (!existsSync(path)) {
    if (onlyUnit) err(uf, "Datei fehlt");
    else warn(uf, "Datei fehlt (noch nicht erstellt)");
    continue;
  }
  let unit;
  try {
    unit = JSON.parse(readFileSync(path, "utf8"));
  } catch (e) {
    err(uf, "JSON-Fehler: " + e.message);
    continue;
  }
  const unitNo = parseInt(uf.slice(5));
  if (unit.unit !== unitNo) err(uf, `unit-Feld ${unit.unit} passt nicht zum Dateinamen`);
  if (!unit.title) err(uf, "title fehlt");
  if (!["A0", "A1", "A2"].includes(unit.level)) err(uf, `level ungültig: ${unit.level}`);
  if (!Array.isArray(unit.lessons) || unit.lessons.length !== 6) {
    err(uf, `genau 6 Lektionen erwartet, gefunden: ${unit.lessons?.length}`);
  }
  (unit.lessons || []).forEach((lesson, li) => validateLesson(unit, lesson, li, uf));
}

function validateLesson(unit, lesson, li, uf) {
  const expectId = `u${String(unit.unit).padStart(2, "0")}_l${String(li + 1).padStart(2, "0")}`;
  const where = lesson.id || `${uf}#${li + 1}`;
  lessonCount++;
  if (lesson.id !== expectId) err(where, `id sollte ${expectId} sein`);
  allLessonIds.add(lesson.id);
  if (!lesson.title) err(where, "title fehlt");
  const rank = Lexicon.lessonRank(lesson.id);

  // --- vocab ---
  const vocab = lesson.vocab || [];
  if (vocab.length < 6 || vocab.length > 10) err(where, `vocab: 6–10 Einträge erwartet, gefunden ${vocab.length}`);
  let outlookCount = 0;
  const outlookEntries = new Set();
  const introducedHere = new Set();
  for (const v of vocab) {
    const g = lex.byCeb.get(normalizeToken(v.ceb || ""));
    if (!g) { err(where, `vocab "${v.ceb}" steht nicht im Glossar`); continue; }
    if (g.ceb !== v.ceb) err(where, `vocab "${v.ceb}": Schreibung weicht vom Glossar ab (${g.ceb})`);
    if (g.de !== v.de) err(where, `vocab "${v.ceb}": de "${v.de}" ≠ Glossar "${g.de}"`);
    if (v.outlook) {
      outlookCount++;
      outlookEntries.add(g);
      if (Lexicon.lessonRank(g.lesson) <= rank) err(where, `Ausblick-Wort "${v.ceb}" ist laut Glossar schon eingeführt (${g.lesson})`);
    } else {
      if (g.lesson !== lesson.id) err(where, `vocab "${v.ceb}" gehört laut Glossar zu ${g.lesson}`);
      introducedHere.add(g);
    }
  }
  if (outlookCount > 1) err(where, `höchstens ein Ausblick-Wort, gefunden ${outlookCount}`);
  for (const g of glossaryByLesson.get(lesson.id) || []) {
    if (!introducedHere.has(g)) err(where, `Glossar-Wort "${g.ceb}" fehlt in der vocab-Liste dieser Lektion`);
  }

  // --- grammar ---
  if (!lesson.grammar || !lesson.grammar.title || !lesson.grammar.text) err(where, "grammar.title/text fehlt");
  else {
    const sentences = lesson.grammar.text.split(/[.!?]+(\s|$)/).filter((s) => s && s.trim().length > 1).length;
    if (sentences > 5) err(where, `grammar.text hat ${sentences} Sätze (max. 5)`);
  }

  // --- surprise ---
  const s = lesson.surprise;
  if (!s || !s.ceb || !s.de || !s.when) err(where, "surprise.ceb/de/when fehlt");

  // --- exercises ---
  const allowed = (e) => Lexicon.lessonRank(e.lesson) <= rank || outlookEntries.has(e);
  const exs = lesson.exercises || [];
  const real = exs.filter((e) => e.type !== "grammar_note");
  const notes = exs.length - real.length;
  if (real.length < 12 || real.length > 18) err(where, `12–18 Übungen erwartet, gefunden ${real.length}`);
  if (notes > 2) err(where, `höchstens 2 grammar_note, gefunden ${notes}`);
  const types = new Set(real.map((e) => e.type));
  if (types.size < 5) err(where, `mindestens 5 Übungstypen, gefunden ${types.size} (${[...types].join(", ")})`);

  const usedEntries = new Map(); // entry -> count (nur in Übungen)
  const checkCeb = (text, label) => {
    if (typeof text !== "string" || !text.trim()) { err(where, `${label}: leerer Cebuano-Text`); return; }
    const { found, unknown, tokens } = lex.analyze(text, allowed);
    for (const [e, c] of found) usedEntries.set(e, (usedEntries.get(e) || 0) + c);
    for (const u of unknown) err(where, `${label}: unbekanntes Wort "${u}" in "${text}"`);
    for (const t of tokens) if (BAD_SPELLING[t]) err(where, `${label}: Schreibung "${t}" → "${BAD_SPELLING[t]}"`);
  };
  const checkDe = (text, label) => {
    if (typeof text !== "string" || !text.trim()) err(where, `${label}: leerer deutscher Text`);
  };

  exs.forEach((ex, i) => {
    const label = `Übung ${i + 1} (${ex.type})`;
    if (!EX_TYPES.includes(ex.type)) { err(where, `${label}: unbekannter Typ`); return; }
    if (ex.vocab) for (const v of ex.vocab) if (!lex.byCeb.get(normalizeToken(v))) err(where, `${label}: vocab "${v}" nicht im Glossar`);
    switch (ex.type) {
      case "multiple_choice": {
        if (!["ceb_de", "de_ceb"].includes(ex.direction)) err(where, `${label}: direction fehlt/ungültig`);
        if (!Array.isArray(ex.options) || ex.options.length !== 4) err(where, `${label}: genau 4 options`);
        else {
          if (new Set(ex.options.map((o) => String(o).toLowerCase())).size !== 4) err(where, `${label}: doppelte Optionen`);
          if (!Number.isInteger(ex.answer) || ex.answer < 0 || ex.answer > 3) err(where, `${label}: answer-Index ungültig`);
        }
        if (ex.direction === "ceb_de") { checkCeb(ex.prompt, label + " prompt"); (ex.options || []).forEach((o) => checkDe(o, label + " option")); }
        else { checkDe(ex.prompt, label + " prompt"); (ex.options || []).forEach((o) => checkCeb(o, label + " option")); }
        break;
      }
      case "word_bank": {
        const dir = ex.direction || "de_ceb";
        if (!Array.isArray(ex.tokens) || !Array.isArray(ex.answer)) { err(where, `${label}: tokens/answer fehlen`); break; }
        const pool = [...ex.tokens];
        for (const a of ex.answer) {
          const k = pool.indexOf(a);
          if (k < 0) err(where, `${label}: answer-Token "${a}" nicht in tokens`);
          else pool.splice(k, 1);
        }
        if (pool.length < 2) err(where, `${label}: mindestens 2 Ablenker-Kacheln (gefunden ${pool.length})`);
        if (ex.tokens.some((t) => /[.,!?]/.test(t))) err(where, `${label}: Satzzeichen gehören nicht in Kacheln`);
        if (dir === "de_ceb") { checkDe(ex.prompt, label + " prompt"); checkCeb(ex.tokens.join(" "), label + " tokens"); (ex.accepted || []).forEach((a) => checkCeb(a, label + " accepted")); }
        else { checkCeb(ex.prompt, label + " prompt"); ex.tokens.forEach((t) => checkDe(t, label + " token")); }
        break;
      }
      case "fill_blank": {
        if (typeof ex.prompt !== "string" || (ex.prompt.match(/___/g) || []).length !== 1) err(where, `${label}: genau ein ___ im prompt`);
        if (!Array.isArray(ex.options) || ex.options.length !== 3) err(where, `${label}: genau 3 options`);
        else if (!Number.isInteger(ex.answer) || ex.answer < 0 || ex.answer > 2) err(where, `${label}: answer-Index ungültig`);
        checkDe(ex.translation, label + " translation");
        checkCeb((ex.prompt || "").replace("___", (ex.options || [])[ex.answer] || ""), label + " prompt");
        (ex.options || []).forEach((o) => checkCeb(o, label + " option"));
        break;
      }
      case "type_answer": {
        checkDe(ex.prompt, label + " prompt");
        checkCeb(ex.answer, label + " answer");
        (ex.accepted || []).forEach((a) => checkCeb(a, label + " accepted"));
        break;
      }
      case "match_pairs": {
        if (!Array.isArray(ex.pairs) || ex.pairs.length !== 5) { err(where, `${label}: genau 5 pairs`); break; }
        if (new Set(ex.pairs.map((p) => normalizeToken(p.ceb))).size !== 5) err(where, `${label}: doppelte ceb in pairs`);
        if (new Set(ex.pairs.map((p) => String(p.de).toLowerCase())).size !== 5) err(where, `${label}: doppelte de in pairs`);
        ex.pairs.forEach((p) => { checkCeb(p.ceb, label + " pair"); checkDe(p.de, label + " pair"); });
        break;
      }
      case "true_false": {
        checkCeb(ex.statement, label + " statement");
        checkDe(ex.translation, label + " translation");
        if (typeof ex.answer !== "boolean") err(where, `${label}: answer muss true/false sein`);
        if (ex.answer === false && !ex.correction) err(where, `${label}: correction fehlt`);
        break;
      }
      case "grammar_note": {
        if (!ex.title || !ex.text) err(where, `${label}: title/text fehlt`);
        break;
      }
    }
  });

  // Überraschungssatz: Orthografie prüfen, unbekannte Wörter nur als Warnung (max. 2)
  if (s && s.ceb) {
    const { unknown, tokens } = lex.analyze(s.ceb, () => true);
    if (unknown.length > 2) err(where, `surprise: ${unknown.length} unbekannte Wörter (max. 2): ${unknown.join(", ")}`);
    else if (unknown.length) warn(where, `surprise: unbekannte Wörter ${unknown.join(", ")}`);
    for (const t of tokens) if (BAD_SPELLING[t]) err(where, `surprise: Schreibung "${t}" → "${BAD_SPELLING[t]}"`);
  }

  // Wiederholungsquote
  if (lesson.id !== "u01_l01") {
    let older = 0, newer = 0;
    for (const e of usedEntries.keys()) {
      if (Lexicon.lessonRank(e.lesson) < rank) older++; else newer++;
    }
    const ratio = older / Math.max(1, older + newer);
    if (ratio < 0.3) err(where, `Wiederholungsquote ${(ratio * 100).toFixed(0)} % (< 30 %): ${older} alte / ${newer} neue Wörter`);
  }
  // Neue Vokabeln sollten in den Übungen vorkommen
  for (const g of introducedHere) {
    if (!usedEntries.has(g)) warn(where, `neues Wort "${g.ceb}" kommt in keiner Übung vor`);
  }
}


// ---------- Extras (Eselsbrücken, Bilder) ----------
const SCENES = ["kitchen", "market", "jeepney", "videocall", "workshop", "garden", "airport", "beach", "school", "livingroom", "street", "party"];
const WHO = ["tim", "langga", "inday", "lola", "dodong", "agila"];
const graphemes = (s) => [...new Intl.Segmenter("de", { granularity: "grapheme" }).segment(s)].length;
for (const uf of unitFiles) {
  const path = join(root, "content/extras", uf + ".json");
  if (!existsSync(path)) { if (onlyUnit) warn(uf, "extras fehlen"); continue; }
  let ex;
  try { ex = JSON.parse(readFileSync(path, "utf8")); } catch (e) { err("extras/" + uf, "JSON-Fehler: " + e.message); continue; }
  const unitNo = parseInt(uf.slice(5));
  const words = glossary.entries.filter((e) => parseInt(e.lesson.slice(1, 3)) === unitNo);
  for (const w of words) {
    const x = ex[w.ceb];
    if (!x) { err("extras/" + uf, `"${w.ceb}" fehlt`); continue; }
    if (typeof x.mnemonic !== "string" || x.mnemonic.trim().length < 30 || x.mnemonic.length > 160) err("extras/" + uf, `"${w.ceb}": mnemonic fehlt oder nicht 30–160 Zeichen`);
    if (!("img" in x)) err("extras/" + uf, `"${w.ceb}": img fehlt (Emoji oder null)`);
    else if (x.img !== null && (typeof x.img !== "string" || graphemes(x.img) !== 1 || /[A-Za-z0-9]/.test(x.img))) err("extras/" + uf, `"${w.ceb}": img muss genau ein Emoji oder null sein (${x.img})`);
  }
  for (const k of Object.keys(ex)) if (!words.some((w) => w.ceb === k)) warn("extras/" + uf, `"${k}" ist kein Wort dieser Unit`);
}

// ---------- Geschichten ----------
for (const uf of unitFiles) {
  const no = uf.slice(5);
  const path = join(root, "content/stories", "story_" + no + ".json");
  if (!existsSync(path)) { if (onlyUnit) warn(uf, "Geschichte fehlt"); continue; }
  const where = "story_" + no;
  let s;
  try { s = JSON.parse(readFileSync(path, "utf8")); } catch (e) { err(where, "JSON-Fehler: " + e.message); continue; }
  if (s.id !== "s" + no) err(where, `id sollte s${no} sein`);
  if (s.unit !== parseInt(no)) err(where, "unit passt nicht");
  if (!/^u\d\d_l\d\d$/.test(s.after || "")) err(where, "after fehlt/ungültig");
  if (!SCENES.includes(s.scene)) err(where, `scene ungültig: ${s.scene}`);
  for (const f of ["title", "intro", "punchline"]) if (!s[f] || typeof s[f] !== "string") err(where, f + " fehlt");
  const rank = Lexicon.lessonRank(s.after || "u01_l01");
  const allowed = (e) => Lexicon.lessonRank(e.lesson) <= rank;
  if (!Array.isArray(s.lines) || s.lines.length < 8 || s.lines.length > 12) err(where, `8–12 lines erwartet, gefunden ${s.lines?.length}`);
  (s.lines || []).forEach((l, i) => {
    if (!WHO.includes(l.who)) err(where, `Zeile ${i + 1}: who ungültig (${l.who})`);
    if (!l.de) err(where, `Zeile ${i + 1}: de fehlt`);
    if (!l.ceb) { err(where, `Zeile ${i + 1}: ceb fehlt`); return; }
    const { unknown, tokens } = lex.analyze(l.ceb, allowed);
    for (const u of unknown) err(where, `Zeile ${i + 1}: unbekanntes Wort "${u}" in "${l.ceb}"`);
    for (const t of tokens) if (BAD_SPELLING[t]) err(where, `Zeile ${i + 1}: Schreibung "${t}" → "${BAD_SPELLING[t]}"`);
  });
  if (!Array.isArray(s.questions) || s.questions.length < 3 || s.questions.length > 4) err(where, "3–4 questions erwartet");
  (s.questions || []).forEach((q, i) => {
    if (!q.q || !Array.isArray(q.options) || q.options.length !== 3 || !Number.isInteger(q.answer) || q.answer < 0 || q.answer > 2) err(where, `Frage ${i + 1}: q/options(3)/answer prüfen`);
  });
}

// ---------- Kultur ----------
{
  const path = join(root, "content/culture.json");
  if (existsSync(path)) {
    let c = null;
    try { c = JSON.parse(readFileSync(path, "utf8")); } catch (e) { err("culture", "JSON-Fehler: " + e.message); }
    if (c) {
      const items = Array.isArray(c) ? c : c.items;
      if (!Array.isArray(items)) err("culture", "Liste erwartet");
      else {
        const perUnit = {};
        items.forEach((it, i) => {
          if (!Number.isInteger(it.unit) || !it.title || !it.text || !it.emoji) err("culture", `Eintrag ${i + 1}: unit/title/emoji/text prüfen`);
          else perUnit[it.unit] = (perUnit[it.unit] || 0) + 1;
        });
        for (const uf of unitFiles) { const n = parseInt(uf.slice(5)); if ((perUnit[n] || 0) < 3) warn("culture", `Unit ${n}: nur ${perUnit[n] || 0} Kästen (3 erwartet)`); }
      }
    }
  }
}

// ---------- Ausgabe ----------
if (!quiet) for (const w of warnings) console.log("WARNUNG " + w);
for (const e of errors) console.log("FEHLER  " + e);
console.log(`\n${lessonCount} Lektionen geprüft, ${errors.length} Fehler, ${warnings.length} Warnungen.`);
process.exit(errors.length ? 1 : 0);
