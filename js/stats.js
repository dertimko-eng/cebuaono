// Alle Statistiken werden aus dem Ereignis-Log berechnet (plus SRS-Stand und Lektionsfortschritt).
import { todayKey, addDays, distribution, categoryOf } from "./srs.js";

export function weekStart(dateKey) {
  const d = new Date(dateKey + "T12:00:00");
  const day = (d.getDay() + 6) % 7; // Montag = 0
  d.setDate(d.getDate() - day);
  return todayKey(d);
}

export function dateKeyOf(t) {
  return todayKey(new Date(t));
}

function pct(c, n) {
  return n ? Math.round((c / n) * 100) : null;
}

function fmtDate(key) {
  const [y, m, d] = key.split("-");
  return `${d}.${m}.${y}`;
}

/**
 * @param {object} p
 * @param {Array} p.events   Ereignis-Log
 * @param {Array} p.words    SRS-Datensätze
 * @param {Array} p.progress Lektionsfortschritt
 * @param {object} p.content Content-Objekt (lessons, glossary, unitOf, levelAfterUnit)
 * @param {object} p.settings
 * @param {object} p.srsHistory  {dateKey: {neu,lernend,gefestigt,gemeistert}}
 * @param {Date} [p.now]
 */
export function computeStats({ events, words, progress, content, settings, srsHistory = {}, now = new Date() }) {
  const today = todayKey(now);
  const answers = events.filter((e) => e.type === "answer");
  const lessonsDone = events.filter((e) => e.type === "lesson_complete");
  const rounds = events.filter((e) => e.type === "trainer_round");

  // ---- Gesamtfortschritt ----
  const learnedWords = words.filter((w) => w.stage >= 1).length;
  const totalWords = content.glossary.entries.length;
  const completedIds = new Set(progress.filter((p) => p.completed).map((p) => p.id));
  const totalLessons = content.lessons.length;
  const completedLessons = completedIds.size;
  let highestUnitDone = 0;
  for (const u of content.units) {
    if (u.lessons.every((l) => completedIds.has(l.id))) highestUnitDone = Math.max(highestUnitDone, u.unit);
  }
  const level = content.levelAfterUnit(highestUnitDone);
  const nextLevel = level === "A2" ? null : level === "A1" ? { level: "A2", unit: 9 } : { level: "A1", unit: 5 };

  // ---- Wortschatz-Stufen ----
  const srsDist = distribution(words);
  const srsSeries = [];
  for (let i = 29; i >= 0; i--) {
    const k = addDays(today, -i);
    srsSeries.push({ date: k, ...(srsHistory[k] || (i === 0 ? srsDist : null) || {}) });
  }
  // Lücken auffüllen (letzter bekannter Stand)
  let last = { neu: 0, lernend: 0, gefestigt: 0, gemeistert: 0 };
  for (const s of srsSeries) {
    if (s.neu == null) Object.assign(s, last);
    else last = { neu: s.neu, lernend: s.lernend, gefestigt: s.gefestigt, gemeistert: s.gemeistert };
  }

  // ---- Trefferquote ----
  const acc = { overall: { c: 0, n: 0 }, byLesson: {}, byUnit: {}, byType: {}, byMode: {} };
  const bump = (obj, key, correct) => {
    const o = (obj[key] ??= { c: 0, n: 0 });
    o.n++;
    if (correct) o.c++;
  };
  for (const a of answers) {
    acc.overall.n++;
    if (a.correct) acc.overall.c++;
    if (a.lesson) {
      bump(acc.byLesson, a.lesson, a.correct);
      bump(acc.byUnit, content.unitOf(a.lesson), a.correct);
    }
    bump(acc.byType, a.exType || a.mode, a.correct);
    bump(acc.byMode, a.mode, a.correct);
  }
  const accuracy = {
    overall: pct(acc.overall.c, acc.overall.n),
    byLesson: Object.fromEntries(Object.entries(acc.byLesson).map(([k, v]) => [k, { pct: pct(v.c, v.n), n: v.n }])),
    byUnit: Object.fromEntries(Object.entries(acc.byUnit).map(([k, v]) => [k, { pct: pct(v.c, v.n), n: v.n }])),
    byType: Object.fromEntries(Object.entries(acc.byType).map(([k, v]) => [k, { pct: pct(v.c, v.n), n: v.n }])),
    byMode: Object.fromEntries(Object.entries(acc.byMode).map(([k, v]) => [k, { pct: pct(v.c, v.n), n: v.n }])),
  };

  // ---- Wochenverlauf (12 Wochen) ----
  const thisWeek = weekStart(today);
  const weeks = [];
  for (let i = 11; i >= 0; i--) weeks.push(addDays(thisWeek, -7 * i));
  const weekIdx = Object.fromEntries(weeks.map((w, i) => [w, i]));
  const wAcc = weeks.map(() => ({ c: 0, n: 0 }));
  const wRet = weeks.map(() => ({ c: 0, n: 0 }));
  const wNew = weeks.map(() => 0);
  const wMin = weeks.map(() => 0);
  const seenWord = new Set();
  const sortedAnswers = [...answers].sort((a, b) => a.t - b.t);
  for (const a of sortedAnswers) {
    const wk = weekIdx[weekStart(dateKeyOf(a.t))];
    if (wk != null) {
      wAcc[wk].n++;
      if (a.correct) wAcc[wk].c++;
      if (a.due && a.firstTry) {
        wRet[wk].n++;
        if (a.correct) wRet[wk].c++;
      }
      wMin[wk] += Math.min(a.dur || 0, 60000);
    }
    if (a.correct) for (const w of a.words || []) {
      if (!seenWord.has(w)) {
        seenWord.add(w);
        if (wk != null) wNew[wk]++;
      }
    }
  }
  const weekly = weeks.map((w, i) => ({
    week: w,
    label: fmtDate(w).slice(0, 5),
    accuracy: pct(wAcc[i].c, wAcc[i].n),
    answers: wAcc[i].n,
    retention: pct(wRet[i].c, wRet[i].n),
    retentionN: wRet[i].n,
    newWords: wNew[i],
    minutes: Math.round(wMin[i] / 60000),
  }));

  // ---- Schwierigste Wörter ----
  const wrongCount = {};
  const totalCount = {};
  for (const a of answers) for (const w of a.words || []) {
    totalCount[w] = (totalCount[w] || 0) + 1;
    if (!a.correct) wrongCount[w] = (wrongCount[w] || 0) + 1;
  }
  const hardest = Object.entries(wrongCount)
    .sort((a, b) => b[1] - a[1] || (totalCount[a[0]] || 0) - (totalCount[b[0]] || 0))
    .slice(0, 10)
    .map(([ceb, wrong]) => {
      const g = content.entry(ceb);
      return { ceb, de: g ? g.de : "", wrong, total: totalCount[ceb] || 0, pct: pct((totalCount[ceb] || 0) - wrong, totalCount[ceb] || 0) };
    });

  // ---- Zeit ----
  const minutesIn = (from, to) => {
    let ms = 0;
    for (const a of answers) {
      const k = dateKeyOf(a.t);
      if (k >= from && k <= to) ms += Math.min(a.dur || 0, 60000);
    }
    return Math.round(ms / 60000);
  };
  const time = {
    today: minutesIn(today, today),
    week: minutesIn(thisWeek, today),
    total: Math.round(answers.reduce((s, a) => s + Math.min(a.dur || 0, 60000), 0) / 60000),
    avgLesson: lessonsDone.length ? Math.round(lessonsDone.reduce((s, l) => s + (l.dur || 0), 0) / lessonsDone.length / 60000 * 10) / 10 : null,
  };

  // ---- Konstanz: Streak, Heatmap ----
  const activeDays = new Set();
  const dayCounts = {};
  // Streak-Freezes: Events {type:"streak_freeze", action:"earn"|"use", date}
  const frozenDays = new Set();
  let freezeEarned = 0, freezeUsed = 0;
  for (const e of events) {
    const k = dateKeyOf(e.t);
    if (e.type === "lesson_complete" || e.type === "trainer_round" || e.type === "story_complete") activeDays.add(k);
    if (e.type === "answer") dayCounts[k] = (dayCounts[k] || 0) + 1;
    if (e.type === "streak_freeze") { if (e.action === "earn") freezeEarned++; else if (e.action === "use" && e.date) { freezeUsed++; frozenDays.add(e.date); } }
  }
  for (const [k, c] of Object.entries(dayCounts)) if (c >= 5) activeDays.add(k);
  const freezes = Math.max(0, Math.min(2, freezeEarned - freezeUsed));
  // Streak: aktive Tage zählen, eingefrorene Tage überbrücken (zählen nicht mit)
  let streak = 0;
  let cursor = activeDays.has(today) ? today : addDays(today, -1);
  while (activeDays.has(cursor) || frozenDays.has(cursor)) {
    if (activeDays.has(cursor)) streak++;
    cursor = addDays(cursor, -1);
  }
  // Lücke vor heute, die Freezes schließen könnten (für den automatischen Einsatz)
  let gap = [];
  if (!activeDays.has(today) && !activeDays.has(addDays(today, -1)) && !frozenDays.has(addDays(today, -1))) {
    let d = addDays(today, -1);
    while (!activeDays.has(d) && !frozenDays.has(d) && gap.length < 30) { gap.push(d); d = addDays(d, -1); }
    if (!activeDays.has(d)) gap = []; // davor war gar kein Streak
  }
  let longest = 0, run = 0, prev = null;
  for (const k of [...activeDays].sort()) {
    run = prev && addDays(prev, 1) === k ? run + 1 : 1;
    longest = Math.max(longest, run);
    prev = k;
  }
  const heatmap = [];
  const heatStart = addDays(weekStart(today), -7 * 11);
  for (let i = 0; i < 84; i++) {
    const k = addDays(heatStart, i);
    heatmap.push({ date: k, count: dayCounts[k] || 0, active: activeDays.has(k), frozen: frozenDays.has(k), future: k > today });
  }

  // ---- Tempo & Hochrechnung ----
  const idxThis = weeks.length - 1;
  const wordsThisWeek = wNew[idxThis];
  const wordsLastWeek = wNew[idxThis - 1];
  // Wörter pro Woche: Ø der letzten 4 vollen Wochen (die laufende Woche erst ab Sonntag), ab der ersten aktiven Woche
  const includeCurrent = now.getDay() === 0;
  const series = includeCurrent ? wNew : wNew.slice(0, -1);
  const firstActive = series.findIndex((n) => n > 0);
  const recent = firstActive < 0 ? [] : series.slice(Math.max(firstActive, series.length - 4));
  const rate = recent.length ? recent.reduce((a, b) => a + b, 0) / recent.length : 0;
  const remaining = Math.max(0, totalWords - seenWord.size);
  let projection = null;
  if (rate > 0 && remaining > 0) {
    const weeksLeft = remaining / rate;
    projection = { date: addDays(today, Math.round(weeksLeft * 7)), weeks: Math.round(weeksLeft), rate: Math.round(rate) };
  }
  const trend = wordsThisWeek > wordsLastWeek ? "up" : wordsThisWeek < wordsLastWeek ? "down" : "flat";

  // ---- Heute ----
  const lessonsToday = lessonsDone.filter((l) => dateKeyOf(l.t) === today).length;
  const xpToday = events.filter((e) => dateKeyOf(e.t) === today).reduce((s, e) => s + (e.xp || 0), 0);
  const xpTotal = events.reduce((s, e) => s + (e.xp || 0), 0);
  const dailyGoal = settings.dailyGoal || 1;
  const dueCount = words.filter((w) => w.stage > 0 && w.due && w.due <= today).length;

  // ---- Wochenrückblick (vorige Woche) ----
  const lastWeekStart = addDays(thisWeek, -7);
  const lastWeekEnd = addDays(thisWeek, -1);
  const inLast = (t) => { const k = dateKeyOf(t); return k >= lastWeekStart && k <= lastWeekEnd; };
  const lwAnswers = answers.filter((a) => inLast(a.t));
  const weeklyReview = {
    from: fmtDate(lastWeekStart),
    to: fmtDate(lastWeekEnd),
    lessons: lessonsDone.filter((l) => inLast(l.t)).length,
    rounds: rounds.filter((r) => inLast(r.t)).length,
    answers: lwAnswers.length,
    accuracy: pct(lwAnswers.filter((a) => a.correct).length, lwAnswers.length),
    minutes: minutesIn(lastWeekStart, lastWeekEnd),
    newWords: wNew[idxThis - 1] || 0,
    activeDays: [...activeDays].filter((k) => k >= lastWeekStart && k <= lastWeekEnd).length,
  };

  return {
    today,
    learnedWords, totalWords, completedLessons, totalLessons, level, nextLevel, highestUnitDone,
    srsDist, srsSeries,
    accuracy, weekly, hardest, time,
    streak, longest, heatmap, freezes, freezeGap: gap, frozenDays: [...frozenDays],
    wordsThisWeek, wordsLastWeek, trend, projection,
    lessonsToday, dailyGoal, xpToday, xpTotal, dueCount,
    weeklyReview,
    answersTotal: answers.length,
  };
}

export { fmtDate, categoryOf };
