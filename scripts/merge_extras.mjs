// Überträgt content/extras/unit_NN.json (mnemonic, img) in content/glossary.json.
// Aufruf: node scripts/merge_extras.mjs
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const gPath = join(root, "content/glossary.json");
const glossary = JSON.parse(readFileSync(gPath, "utf8"));
const index = JSON.parse(readFileSync(join(root, "content/index.json"), "utf8"));
let merged = 0, imgs = 0, missing = 0;
const extras = {};
for (const uf of index.units) {
  const p = join(root, "content/extras", uf + ".json");
  if (!existsSync(p)) continue;
  Object.assign(extras, JSON.parse(readFileSync(p, "utf8")));
}
for (const e of glossary.entries) {
  const x = extras[e.ceb];
  if (!x) { missing++; continue; }
  if (x.mnemonic) { e.mnemonic = x.mnemonic.trim(); merged++; }
  if (x.img) { e.img = x.img; imgs++; } else delete e.img;
}
writeFileSync(gPath, JSON.stringify(glossary, null, 2) + "\n");
console.log(`${merged} Eselsbrücken, ${imgs} Bilder übernommen, ${missing} Wörter ohne Extras.`);
