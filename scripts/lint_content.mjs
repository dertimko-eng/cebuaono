import { readFileSync } from "node:fs";
import { Lexicon } from "../js/lexicon.js";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));
const g = JSON.parse(readFileSync(root + "content/glossary.json", "utf8"));
const names = JSON.parse(readFileSync(root + "content/names.json", "utf8")).names;
const lex = new Lexicon(g, names);
const idx = JSON.parse(readFileSync(root + "content/index.json", "utf8"));
const out = [];
const cebFields = (ex) => {
  switch (ex.type) {
    case "multiple_choice": return ex.direction === "ceb_de" ? [ex.prompt] : ex.options;
    case "word_bank": return (ex.direction || "de_ceb") === "de_ceb" ? [...ex.tokens, ...(ex.accepted || [])] : [ex.prompt];
    case "fill_blank": return [ex.prompt, ...ex.options];
    case "type_answer": return [ex.answer, ...(ex.accepted || [])];
    case "match_pairs": return ex.pairs.map((p) => p.ceb);
    case "true_false": return [ex.statement];
    default: return [];
  }
};
const deFields = (ex) => {
  switch (ex.type) {
    case "multiple_choice": return ex.direction === "ceb_de" ? ex.options : [ex.prompt];
    case "word_bank": return (ex.direction || "de_ceb") === "de_ceb" ? [ex.prompt] : ex.tokens;
    case "fill_blank": return [ex.translation];
    case "type_answer": return [ex.prompt];
    case "match_pairs": return ex.pairs.map((p) => p.de);
    case "true_false": return [ex.translation, ex.correction || ""];
    default: return [];
  }
};
let noWords = 0, total = 0;
for (const u of idx.units) {
  const unit = JSON.parse(readFileSync(root + `content/units/${u}.json`, "utf8"));
  for (const l of unit.lessons) {
    const seenPrompts = new Set();
    l.exercises.forEach((ex, i) => {
      const tag = `${l.id} #${i + 1} ${ex.type}`;
      for (const s of cebFields(ex)) if (/[äöüßÄÖÜ]/.test(s)) out.push(`${tag}: Umlaut im Cebuano-Feld "${s}"`);
      for (const s of deFields(ex)) if (s && /\b(ang|nga|ug|ko|ka|siya|nako|nimo)\b/.test(s) && !/[„"]/.test(s)) out.push(`${tag}: Cebuano-Wort im deutschen Feld? "${s}"`);
      for (const s of [...cebFields(ex), ...deFields(ex)]) if (s && (s !== s.trim() || /\s{2,}/.test(s))) out.push(`${tag}: Leerzeichen-Problem "${s}"`);
      if (ex.type === "multiple_choice") {
        const correct = ex.options[ex.answer];
        if (ex.direction === "ceb_de") {
          // identical German meaning for two options?
          const norm = ex.options.map((o) => o.toLowerCase().replace(/[.!?]/g, "").trim());
          if (new Set(norm).size < 4) out.push(`${tag}: Optionen nach Normalisierung doppelt`);
        }
        if (ex.prompt === correct) out.push(`${tag}: Prompt gleich Antwort`);
      }
      if (ex.type === "true_false" && ex.answer === false && ex.translation.toLowerCase() === (ex.correction || "").toLowerCase()) out.push(`${tag}: correction = translation`);
      if (ex.type === "fill_blank" && !ex.prompt.includes("___")) out.push(`${tag}: kein ___`);
      if (ex.type !== "grammar_note") {
        total++;
        const key = ex.prompt || ex.statement || JSON.stringify(ex.pairs);
        if (seenPrompts.has(key + ex.type)) out.push(`${tag}: doppelte Übung (gleicher Prompt)`);
        seenPrompts.add(key + ex.type);
        // words trained
        const texts = cebFields(ex);
        const found = new Set();
        for (const t of texts.slice(0, 1)) for (const e of lex.analyze(t).found.keys()) found.add(e.ceb);
        if (!found.size) { noWords++; out.push(`${tag}: keine Wörter erkannt (${texts[0]})`); }
      }
    });
  }
}
console.log(out.join("\n"));
console.log(`\n${total} Übungen, ${noWords} ohne erkannte Wörter, ${out.length} Hinweise`);
