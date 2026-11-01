// Listet die Glossar-Wörter einer Unit (oder bis zu einer Lektion) mit Aussprache:
//   node scripts/list_words.mjs 3          Wörter der Unit 3
//   node scripts/list_words.mjs upto u03_l06   alle bis einschließlich dieser Lektion (für Geschichten)
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { pronounce } from "../js/pronounce.js";
import { Lexicon } from "../js/lexicon.js";
const root = fileURLToPath(new URL("../", import.meta.url));
const g = JSON.parse(readFileSync(join(root, "content/glossary.json"), "utf8"));
const [a, b] = process.argv.slice(2);
let list;
if (a === "upto") { const r = Lexicon.lessonRank(b); list = g.entries.filter((e) => Lexicon.lessonRank(e.lesson) <= r); }
else { const u = "u" + String(a).padStart(2, "0"); list = g.entries.filter((e) => e.lesson.startsWith(u)); }
for (const e of list) console.log([e.lesson, e.ceb, pronounce(e.ceb), e.de, e.pos, e.note || ""].join(" | "));
console.error(list.length + " Wörter");
