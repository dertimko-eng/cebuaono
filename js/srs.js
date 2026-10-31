// Spaced Repetition (SM-2-light): Stufen 0–5 mit Intervallen 0, 1, 3, 7, 14, 30 Tage.
// Ein Wort braucht pro Stufe 1 Punkt. Voller Schritt (Tippen, Word-Bank, Schwer-Modus) = 1 Punkt,
// halber Schritt (Multiple Choice, Richtig/Falsch, Paare, Einfach-Modus) = 0,5 Punkte.
// Fehler: zurück auf Stufe 1, fällig morgen.

export const INTERVALS = [0, 1, 3, 7, 14, 30];
export const MAX_STAGE = 5;

export const CATEGORY = {
  0: "neu",
  1: "lernend",
  2: "lernend",
  3: "gefestigt",
  4: "gefestigt",
  5: "gemeistert",
};
export const CATEGORY_ORDER = ["neu", "lernend", "gefestigt", "gemeistert"];

export function todayKey(d = new Date()) {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return z.toISOString().slice(0, 10);
}

export function addDays(dateKey, n) {
  const d = new Date(dateKey + "T12:00:00");
  d.setDate(d.getDate() + n);
  return todayKey(d);
}

export function newWord(ceb) {
  return { ceb, stage: 0, points: 0, due: null, correct: 0, wrong: 0, near: 0, lastSeen: null, updatedAt: 0 };
}

export function categoryOf(word) {
  return CATEGORY[Math.min(MAX_STAGE, Math.max(0, word?.stage ?? 0))];
}

export function isDue(word, today = todayKey()) {
  if (!word || word.stage === 0) return false;
  return !!word.due && word.due <= today;
}

/**
 * Wendet ein Übungsergebnis an (mutiert und liefert das Wort).
 * @param {object} word   SRS-Datensatz
 * @param {boolean} correct
 * @param {number} weight 1 = voller Schritt, 0.5 = halber Schritt
 * @param {boolean} near  „fast richtig“ (zählt als richtig, wird separat gezählt)
 */
export function applyResult(word, correct, weight = 1, near = false, today = todayKey()) {
  const now = Date.now();
  word.lastSeen = now;
  word.updatedAt = now;
  if (correct) {
    word.correct++;
    if (near) word.near++;
    word.points = (word.points || 0) + weight;
    while (word.points >= 1 && word.stage < MAX_STAGE) {
      word.points -= 1;
      word.stage++;
    }
    if (word.stage >= MAX_STAGE) word.points = 0;
    if (word.stage === 0) word.stage = 1; // erster Kontakt zählt mindestens als „lernend“
    word.due = addDays(today, INTERVALS[word.stage]);
  } else {
    word.wrong++;
    word.stage = 1;
    word.points = 0;
    word.due = addDays(today, 1);
  }
  return word;
}

// Gewicht nach Übungstyp / Modus
export function weightFor(exType, mode) {
  if (mode === "trainer_hard") return 1;
  if (mode === "trainer_easy") return 0.5;
  return ["type_answer", "word_bank", "fill_blank"].includes(exType) ? 1 : 0.5;
}

export function distribution(words) {
  const d = { neu: 0, lernend: 0, gefestigt: 0, gemeistert: 0 };
  for (const w of words) d[categoryOf(w)]++;
  return d;
}
