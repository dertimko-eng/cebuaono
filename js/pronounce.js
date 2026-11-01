// Aussprache-Hilfe: schreibt Cebuano so, wie ein Deutscher es lesen würde.
// Regeln (Cebuano ist sehr lautgetreu):
//   a e i o u  wie im Deutschen, kurz; e und o eher offen
//   s          immer scharf (ß), nie stimmhaft
//   y          wie deutsches j
//   w          wie englisches w (kurzes u mit Lippenrundung)
//   ng         wie in „singen“, auch am Wortanfang (nga)
//   ay aw uy oy iw  Diphthonge: ai, au, ui, oi, iu
//   -          im Wortinnern ein kurzer Stimmabsatz wie in „Spiegel|ei“ (kan-on) → '
//   r gerollt, h immer hörbar, p/t/k ohne Behauchung
// Die Betonung ist im Cebuano nicht vorhersagbar und wird deshalb nicht markiert.

// Vorsilben mit Bindestrich vor Namen/Zahlen (taga-Cebu, ika-duha): kein Stimmabsatz
const PREFIXES = new Set(["taga", "ika", "pinaka"]);
const DIPH = { ay: "ai", aw: "au", uy: "ui", oy: "oi", iw: "iu", ey: "ei", ow: "ou" };

// Ein einzelnes Wort (ohne Leerzeichen) in Silben zerlegen und umschreiben.
function word(w) {
  const lower = w.toLowerCase();
  if (!/[a-z]/.test(lower)) return w;
  // Reduplikation (salo-salo) → beide Teile einzeln, mit Bindestrich; Präfix mit Endstrich (taga-) → ohne
  if (lower.includes("-")) {
    const parts = lower.split("-").filter(Boolean);
    let r = lower.endsWith("-") ? parts.map(word).join("-") + "-"
      : (parts.length === 2 && parts[0] === parts[1]) || PREFIXES.has(parts[0]) ? parts.map(word).join("-")
      : parts.map(word).join("'");
    return /^[A-Z]/.test(w) ? cap(r) : r;
  }
  // Tokenisieren: ng als ein Konsonant
  const units = [];
  for (let i = 0; i < lower.length; i++) {
    const two = lower.slice(i, i + 2);
    if (two === "ng" || two === "ts" || two === "ch" || two === "ny" || two === "ll" || two === "qu") { units.push(two); i++; }
    else units.push(lower[i]);
  }
  const isV = (u) => /^[aeiou]$/.test(u);
  // Silben: V | CV | CVC …; Diphthong-Glide (y/w nach Vokal) gehört zur Silbe, wenn danach Konsonant/Ende
  const syl = [];
  let cur = "";
  for (let i = 0; i < units.length; i++) {
    const u = units[i];
    if (isV(u)) {
      cur += u;
      const next = units[i + 1], after = units[i + 2];
      if ((next === "y" || next === "w") && (after === undefined || !isV(after))) { cur += next; i++; }
      // Koda: ein Konsonant, wenn danach noch ein Konsonant folgt (VC-CV)
      const n1 = units[i + 1], n2 = units[i + 2];
      if (n1 && !isV(n1) && n2 && !isV(n2)) { cur += n1; i++; }
      else if (n1 && !isV(n1) && n2 === undefined) { cur += n1; i++; }
      syl.push(cur); cur = "";
    } else {
      cur += u;
    }
  }
  if (cur) { if (syl.length) syl[syl.length - 1] += cur; else syl.push(cur); }
  const map = (s) => {
    let out = "";
    for (let i = 0; i < s.length; i++) {
      const two = s.slice(i, i + 2);
      if (DIPH[two]) { out += DIPH[two]; i++; continue; }
      if (two === "ng") { out += "ng"; i++; continue; }
      if (two === "ts" || two === "ch") { out += "tsch"; i++; continue; }
      if (two === "ny") { out += "nj"; i++; continue; }
      if (two === "ll") { out += "lj"; i++; continue; }
      if (two === "dy" && /[aeiou]/.test(s[i + 2] || "")) { out += "dsch"; i++; continue; }
      if (two === "qu") { out += "k"; i++; continue; }
      const c = s[i];
      out += { s: "ß", y: "j", z: "ß", v: "b", j: "dsch", x: "ks", q: "k", c: /[ei]/.test(s[i + 1] || "") ? "ß" : "k", f: "f" }[c] ?? c;
    }
    return out;
  };
  const res = syl.map(map).join("-");
  return /^[A-Z]/.test(w) ? cap(res) : res;
}
function cap(s) { return s.startsWith("ß") ? s : s[0].toUpperCase() + s.slice(1); }

// Überschreibungen aus dem Glossar (Feld "pron", z. B. "ßa-LA-mat" mit betonter Silbe in Großbuchstaben).
// Schlüssel: ceb in Kleinbuchstaben. Mehrwortige Einträge gelten für die ganze Wortfolge.
const overrides = new Map();
export function setPronOverrides(entries) {
  overrides.clear();
  for (const e of entries || []) if (e.pron && e.ceb) overrides.set(e.ceb.toLowerCase(), e.pron);
}

/** Aussprache eines Wortes oder Satzes. Satzzeichen bleiben erhalten. */
export function pronounce(text) {
  if (!text) return "";
  const toks = String(text).split(/(\s+)/);
  const out = [];
  for (let i = 0; i < toks.length; i++) {
    const tok = toks[i];
    if (!tok.trim()) { out.push(tok); continue; }
    const m = tok.match(/^([^A-Za-z]*)([A-Za-z][A-Za-z-]*)([^A-Za-z]*)$/);
    if (!m) { out.push(tok); continue; }
    // Mehrwort-Überschreibung (z. B. "Maayong buntag"): bis zu 3 Wörter zusammen prüfen
    let hit = null;
    for (let n = 3; n >= 1 && !hit; n--) {
      const idx = i + (n - 1) * 2;
      if (idx >= toks.length) continue;
      const words = [];
      for (let k = i; k <= idx; k += 2) { const mm = toks[k].match(/^[^A-Za-z]*([A-Za-z][A-Za-z-]*)[^A-Za-z]*$/); if (!mm) { words.length = 0; break; } words.push(mm[1]); }
      if (!words.length) continue;
      const o = overrides.get(words.join(" ").toLowerCase());
      if (o) { const last = toks[idx].match(/([^A-Za-z]*)$/)[1]; hit = { text: m[1] + keepCase(o, m[2]) + last, skip: idx - i }; }
    }
    if (hit) { out.push(hit.text); i += hit.skip; continue; }
    out.push(m[1] + keepCase(overrides.get(m[2].toLowerCase()) || word(m[2]), m[2]) + m[3]);
  }
  return out.join("");
}
function keepCase(pron, orig) { return /^[A-Z]/.test(orig) && !/^[A-Z]/.test(pron) ? cap(pron) : pron; }

export const PRON_LEGEND = [
  ["ß", "scharfes s wie in „Fuß“ – Cebuano-s ist nie stimmhaft (salamat → ßa-la-mat)"],
  ["j", "wie deutsches j in „ja“ (babaye → ba-ba-je)"],
  ["w", "wie englisches w, ein kurzes u mit runden Lippen (wala → wa-la)"],
  ["ng", "wie in „singen“, auch am Wortanfang (nga → nga, nganong → nga-nong)"],
  ["ai, au, ui, oi", "Zwielaute wie in „Mai“, „Haus“, „pfui“ (balay → ba-lai, ikaw → i-kau)"],
  ["'", "kurzer Stimmabsatz wie in „Spiegel|ei“ oder „be|achten“ (kan-on → kan'on)"],
  ["a e i o u", "kurz und klar wie im Deutschen; e und o eher offen"],
  ["r", "gerollt (Zungenspitze), wie im Bairischen oder Spanischen"],
  ["h", "immer hörbar, auch am Wortende (buntag → bun-tag, aber Cebu → ße-bu)"],
  ["p t k", "ohne Hauch, weicher als im Deutschen"],
  ["Betonung", "nicht aus der Schreibung ableitbar, meist auf der vorletzten Silbe. Beim Mithören merken – deine Frau ist hier die Referenz."],
];
