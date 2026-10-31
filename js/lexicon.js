// Gemeinsame Wort-Logik für App und Validator (ESM, läuft im Browser und in Node).
// Aufgabe: Cebuano-Text in Tokens zerlegen und jedes Token einem Glossar-Eintrag zuordnen,
// inkl. Abtrennen von Verb-Affixen (mo-, nag-, gi-, -on, -a …).

export const PREFIXES = [
  "nagpaka", "magpaka", "nakapag", "makapag", "nagpa", "magpa", "mopa", "nipa", "mipa", "gipa", "ipa", "pagpa",
  "nagka", "magka", "naka", "maka", "naga", "maga", "nang", "mang", "pang", "pagka", "nag", "mag", "nig", "mig",
  "mo", "mu", "ni", "mi", "gi", "gina", "ka", "pag", "pa", "ma", "na", "i", "taga", "tag", "ting", "labing", "pinaka", "ika", "man", "nan", "tig", "ipang", "gipang", "panag", "nanag", "manag", "kina", "hing", "hin", "tinag", "sinag", "um", "in", "nakig", "makig", "nakipag", "makipag", "paki", "pakig", "pakipag",
];
export const SUFFIXES = ["anay", "anan", "onon", "ahon", "ahan", "han", "hon", "an", "on", "ay", "ng", "y", "g", "a", "i", "ha", "hi"];

const DIACRITICS = /[̀-ͯ]/g;

export function normalizeToken(t) {
  return t
    .toLowerCase()
    .normalize("NFD")
    .replace(DIACRITICS, "")
    .replace(/[’'`´]/g, "")
    .replace(/^[^a-z0-9-]+|[^a-z0-9-]+$/g, "");
}

// Zerlegt einen Satz in Wort-Tokens (Bindestrich innerhalb eines Wortes bleibt erhalten).
export function tokenize(text) {
  return String(text)
    .split(/[\s,.;:!?()"„“”«»\/\[\]…]+/)
    .map(normalizeToken)
    .filter((t) => t && t !== "-" && t !== "___");
}

export class Lexicon {
  constructor(glossary, names = []) {
    this.entries = glossary.entries;
    this.names = new Set(names.map((n) => normalizeToken(n)));
    this.byCeb = new Map(); // normalisierte ceb -> entry
    this.tokenMap = new Map(); // einzelnes token -> entry (Einzelwort-Einträge und forms)
    this.phraseWordMap = new Map(); // token -> entry (Wörter aus Mehrwort-Einträgen)
    this.phrases = []; // [{tokens:[...], entry}]
    this.lessonOrder = new Map();
    for (const e of this.entries) {
      const n = normalizeToken(e.ceb);
      this.byCeb.set(n, e);
      const toks = tokenize(e.ceb);
      if (toks.length === 1) {
        this.tokenMap.set(toks[0], e);
      } else {
        this.phrases.push({ tokens: toks, entry: e });
        for (const t of toks) if (!this.phraseWordMap.has(t)) this.phraseWordMap.set(t, e);
      }
      for (const f of e.forms || []) {
        const ft = tokenize(f);
        if (ft.length === 1 && !this.tokenMap.has(ft[0])) this.tokenMap.set(ft[0], e);
      }
    }
  }

  static lessonRank(id) {
    const m = /^u(\d\d)_l(\d\d)$/.exec(id);
    return m ? parseInt(m[1]) * 100 + parseInt(m[2]) : 999999;
  }

  isName(t) {
    return this.names.has(t);
  }

  // Liefert den Glossar-Eintrag für ein Token (oder null). `allowed` ist optional
  // eine Funktion entry => bool (z. B. „bis zu dieser Lektion eingeführt“).
  lookup(token, allowed = () => true) {
    const t = normalizeToken(token);
    if (!t) return null;
    const direct = this.tokenMap.get(t);
    if (direct && allowed(direct)) return direct;
    const pw = this.phraseWordMap.get(t);
    if (pw && allowed(pw)) return pw;
    // Verdopplung mit Bindestrich: adlaw-adlaw, hinay-hinay
    if (t.includes("-")) {
      const [a, b] = t.split("-");
      if (a && a === b) {
        const r = this.lookup(a, allowed);
        if (r) return r;
      }
    }
    return this.stripAffixes(t, allowed);
  }

  stripAffixes(t, allowed, depth = 0) {
    if (depth > 2) return null;
    const tryRoot = (root) => {
      if (root.length < 3) return null;
      const e = this.tokenMap.get(root) || this.phraseWordMap.get(root);
      if (e && allowed(e)) return e;
      return null;
    };
    // Bindestrich nach Präfix (mag-usa, nag-ulan) entfernen
    const candidates = new Set([t, t.replace(/^([a-z]+)-/, "$1")]);
    for (const c of candidates) {
      for (const p of PREFIXES) {
        if (c.startsWith(p) && c.length - p.length >= 3) {
          let rest = c.slice(p.length);
          let r = tryRoot(rest) || this.suffixRoot(rest, tryRoot);
          if (r) return r;
          // Verdopplung der ersten Silbe: magluluto -> luto, mokaon-kaon
          const red = rest.replace(/^([bcdfghjklmnpqrstvwxyz]?[aeiou])\1/, "$1");
          if (red !== rest) {
            r = tryRoot(red) || this.suffixRoot(red, tryRoot);
            if (r) return r;
          }
          // Infix -in- nach Präfix (gisinulat) oder Nasal-Assimilation (mang+kaon -> mangaon, nang+hugas -> nanghugas)
          if (p.endsWith("ng")) {
            for (const k of ["k", "g", "p", "b", "t", "d", "s", "h"]) {
              r = tryRoot(k + rest) || this.suffixRoot(k + rest, tryRoot);
              if (r) return r;
            }
          }
          if (p === "mang" || p === "nang" || p === "pang" || p === "man" || p === "nan") {
            // ma-ngaon -> kaon (ng ersetzt k), mamalit -> palit, manaog -> naog, maniudto -> paniudto
            const nasal = { mam: "p", nam: "p", man: "t", nan: "t", mang: "k", nang: "k", pang: "k", mam2: "b" };
            const first = c.slice(0, 3);
            for (const [pre, cons] of Object.entries(nasal)) {
              const pp = pre.replace(/\d/, "");
              if (c.startsWith(pp)) {
                const base = cons + c.slice(pp.length);
                r = tryRoot(base) || this.suffixRoot(base, tryRoot);
                if (r) return r;
              }
            }
            void first;
          }
        }
      }
      // Infix -in-: sinulat -> sulat, tinudlo -> tudlo, hinimo -> himo, binisaya
      const inf = c.replace(/^([bcdfghjklmnpqrstvwxyz])in/, "$1");
      if (inf !== c) {
        const r = tryRoot(inf) || this.suffixRoot(inf, tryRoot);
        if (r) return r;
      }
      // -um-: umaabot -> abot
      const um = c.replace(/^um([aeiou])\1?/, "$1");
      if (um !== c) {
        const r = tryRoot(um) || this.suffixRoot(um, tryRoot);
        if (r) return r;
      }
      // nur Suffix
      const r = this.suffixRoot(c, tryRoot);
      if (r) return r;
    }
    return null;
  }

  suffixRoot(word, tryRoot) {
    for (const s of SUFFIXES) {
      if (word.endsWith(s) && word.length - s.length >= 3) {
        let base = word.slice(0, -s.length);
        let r = tryRoot(base);
        if (r) return r;
        // Vokalausfall bei Suffix: sulat+on -> sulaton ok; tulog+a -> tulga (o fällt weg), sakay+an -> sakyan
        for (const v of ["a", "e", "i", "o", "u"]) {
          r = tryRoot(base.slice(0, -1) + v + base.slice(-1));
          if (r) return r;
          r = tryRoot(base + v);
          if (r) return r;
        }
        // h-Einschub: kanta+hon -> kantahon (durch 'hon' abgedeckt), basa+ha -> basaha
        if (base.endsWith("h")) {
          r = tryRoot(base.slice(0, -1));
          if (r) return r;
        }
        // Glottis-Bindestrich: kan-on -> kaon? (nein, eigenes Wort) – tun-i -> tuon, dad-a -> dala, kit-a -> kita
        if (base.includes("-")) {
          const nb = base.replace("-", "");
          r = tryRoot(nb);
          if (r) return r;
          for (const v of ["a", "e", "i", "o", "u"]) {
            r = tryRoot(nb.slice(0, -1) + v + nb.slice(-1));
            if (r) return r;
          }
        }
      }
    }
    return null;
  }

  // Findet alle Glossar-Einträge in einem Cebuano-Text (Mehrwort-Phrasen zuerst).
  // Rückgabe: Map entry -> count; unknown: Liste nicht zuordenbarer Tokens.
  analyze(text, allowed = () => true) {
    const toks = tokenize(text);
    const found = new Map();
    const unknown = [];
    const used = new Array(toks.length).fill(false);
    for (const ph of this.phrases) {
      if (!allowed(ph.entry)) continue;
      const n = ph.tokens.length;
      for (let i = 0; i + n <= toks.length; i++) {
        if (used.slice(i, i + n).some(Boolean)) continue;
        let ok = true;
        for (let j = 0; j < n; j++) if (toks[i + j] !== ph.tokens[j]) { ok = false; break; }
        if (ok) {
          found.set(ph.entry, (found.get(ph.entry) || 0) + 1);
          for (let j = 0; j < n; j++) used[i + j] = true;
        }
      }
    }
    toks.forEach((t, i) => {
      if (used[i]) return;
      if (/^\d+$/.test(t) || this.isName(t)) return;
      const e = this.lookup(t, allowed);
      if (e) found.set(e, (found.get(e) || 0) + 1);
      else unknown.push(t);
    });
    return { found, unknown, tokens: toks };
  }
}
