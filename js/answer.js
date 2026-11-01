// Zentrale, gnädige Antwortbewertung – benutzt von Lektion UND Vokabeltrainer.
// Siehe CONTENT_SPEC.md Abschnitt 5.

const REPLACEMENTS = [
  [/\bog\b/g, "ug"],
  [/\bjud\b/g, "gyud"],
  [/\bgyod\b/g, "gyud"],
  [/\bgayud\b/g, "gyud"],
  [/\bnganu\b/g, "ngano"],
  [/\bkabalo\b/g, "kahibalo"],
];

export function normalizeAnswer(s) {
  let t = String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // Akzente
    .replace(/[-'’`´]/g, "") // Bindestriche, Apostrophe
    .replace(/[.,!?;:…"„“”]+/g, " ") // Satzzeichen
    .replace(/\s+/g, " ")
    .trim();
  for (const [re, rep] of REPLACEMENTS) t = t.replace(re, rep);
  return t;
}

export function levenshtein(a, b) {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = new Array(n + 1);
  let cur = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    cur[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, cur] = [cur, prev];
  }
  return prev[n];
}

function wordTolerance(w) {
  // Bei ganz kurzen Wörtern (ko/ka, ni/si, sa) ist ein Buchstabe der ganze Unterschied – keine Toleranz
  return w.length <= 3 ? 0 : w.length <= 5 ? 1 : 2;
}

// Vergleicht Eingabe mit einer Zielantwort Wort für Wort.
// Rückgabe: "exact" | "near" | null
function compareOne(input, target) {
  const a = normalizeAnswer(input);
  const b = normalizeAnswer(target);
  if (!a || !b) return null;
  if (a === b) return "exact";
  const wa = a.split(" "), wb = b.split(" ");
  if (wa.length !== wb.length) {
    // Toleranz: Gesamtstring bei Einzelwörtern, die zusammen/getrennt geschrieben wurden
    const ja = wa.join(""), jb = wb.join("");
    if (ja === jb) return "near";
    if (wb.length === 1 && levenshtein(ja, jb) <= wordTolerance(jb)) return "near";
    return null;
  }
  for (let i = 0; i < wa.length; i++) {
    if (wa[i] === wb[i]) continue;
    if (levenshtein(wa[i], wb[i]) > wordTolerance(wb[i])) return null;
  }
  return "near";
}

/**
 * @param {string} input  Eingabe des Nutzers
 * @param {string} answer Hauptantwort
 * @param {string[]} accepted alternative Antworten
 * @returns {{ok:boolean, near:boolean, expected:string}}
 */
export function isAnswerAcceptable(input, answer, accepted = []) {
  const targets = [answer, ...(accepted || [])].filter(Boolean);
  let nearTarget = null;
  for (const t of targets) {
    const r = compareOne(input, t);
    if (r === "exact") return { ok: true, near: false, expected: t };
    if (r === "near" && !nearTarget) nearTarget = t;
  }
  if (nearTarget) return { ok: true, near: true, expected: nearTarget };
  return { ok: false, near: false, expected: answer };
}
