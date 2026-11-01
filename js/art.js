// Grafiken ohne externe Dateien: Adler-Maskottchen, Unit-Abzeichen, Konfetti.
// Alles Inline-SVG, damit es offline und ohne Build funktioniert.
import { h } from "./ui.js";

// ---------- Adler (Philippinenadler: helles Gesicht, brauner Federkamm, dunkler Schnabel) ----------
const C = {
  body: "#6b4226", bodyDark: "#4a2c17", belly: "#f6ecd9", face: "#f6ecd9",
  crest: "#8a5a35", crestDark: "#4a2c17", beak: "#3b3b3b", beakLight: "#5a5a5a",
  eye: "#5f8ca5", foot: "#e2a93b", cheek: "#f3b7a6",
};

/**
 * Baut den Adler als SVG-String.
 * @param {"wave"|"cheer"|"sad"|"think"|"idle"|"sleep"} mood
 * @param {number} size  Breite/Höhe in px
 */
export function eagleSvg(mood = "idle", size = 120) {
  // Flügel-Stellung
  const wingL = { idle: 0, wave: 0, cheer: -70, sad: 10, think: 0, sleep: 5 }[mood] ?? 0;
  const wingR = { idle: 0, wave: -80, cheer: 70, sad: -10, think: -55, sleep: -5 }[mood] ?? 0;
  const eyes = (() => {
    if (mood === "cheer") return `
      <path d="M72 78 q8 -9 16 0" stroke="#222" stroke-width="4" fill="none" stroke-linecap="round"/>
      <path d="M112 78 q8 -9 16 0" stroke="#222" stroke-width="4" fill="none" stroke-linecap="round"/>`;
    if (mood === "sleep") return `
      <path d="M72 80 q8 6 16 0" stroke="#222" stroke-width="4" fill="none" stroke-linecap="round"/>
      <path d="M112 80 q8 6 16 0" stroke="#222" stroke-width="4" fill="none" stroke-linecap="round"/>`;
    const lid = mood === "sad" ? `
      <path d="M68 68 l22 8" stroke="${C.face}" stroke-width="9" stroke-linecap="round"/>
      <path d="M132 68 l-22 8" stroke="${C.face}" stroke-width="9" stroke-linecap="round"/>` : mood === "think" ? `
      <path d="M66 70 l24 2" stroke="${C.face}" stroke-width="9" stroke-linecap="round"/>` : "";
    const px = mood === "think" ? 3 : 0;
    return `
      <circle cx="80" cy="80" r="11" fill="#fff"/><circle cx="120" cy="80" r="11" fill="#fff"/>
      <circle cx="${82 + px}" cy="81" r="7" fill="${C.eye}"/><circle cx="${122 + px}" cy="81" r="7" fill="${C.eye}"/>
      <circle cx="${83 + px}" cy="82" r="3.6" fill="#111"/><circle cx="${123 + px}" cy="82" r="3.6" fill="#111"/>
      <circle cx="${80 + px}" cy="78" r="2" fill="#fff"/><circle cx="${120 + px}" cy="78" r="2" fill="#fff"/>
      ${lid}`;
  })();
  const brows = mood === "sad" ? `<path d="M70 68 l20 -6 M130 68 l-20 -6" stroke="${C.crestDark}" stroke-width="4" stroke-linecap="round"/>`
    : mood === "cheer" || mood === "wave" ? `<path d="M68 64 l22 -4 M132 64 l-22 -4" stroke="${C.crestDark}" stroke-width="4" stroke-linecap="round"/>` : "";
  const mouth = mood === "sad" ? `<path d="M92 112 q8 -5 16 0" stroke="${C.beak}" stroke-width="2.5" fill="none"/>`
    : mood === "cheer" ? `<path d="M90 110 q10 10 20 0" stroke="${C.beak}" stroke-width="2.5" fill="none"/>` : "";
  const extra = mood === "sleep" ? `<text x="140" y="40" font-size="22" font-weight="700" fill="${C.eye}" font-family="sans-serif">z</text><text x="152" y="26" font-size="16" font-weight="700" fill="${C.eye}" font-family="sans-serif">z</text>`
    : mood === "think" ? `<circle cx="150" cy="40" r="5" fill="${C.eye}" opacity=".6"/><circle cx="160" cy="28" r="7" fill="${C.eye}" opacity=".5"/>` : "";
  // Federkamm: Fächer aus spitzen Federn
  const crest = [-62, -48, -34, -20, -6, 8, 22, 36, 50].map((a, i) => {
    const len = 40 + (i % 3) * 7;
    return `<path d="M100 66 L${100 + Math.sin(a * Math.PI / 180) * len} ${66 - Math.cos(a * Math.PI / 180) * len} L${100 + Math.sin((a + 7) * Math.PI / 180) * (len - 10)} ${66 - Math.cos((a + 7) * Math.PI / 180) * (len - 10)} Z" fill="${i % 2 ? C.crest : C.crestDark}"/>`;
  }).join("");
  const wing = (side, deg) => {
    const sx = side === "l" ? -1 : 1;
    return `<g transform="translate(${100 + sx * 44} 122) rotate(${sx * deg})">
      <path d="M0 -14 Q${sx * 40} -10 ${sx * 48} 30 Q${sx * 30} 42 0 34 Z" fill="${C.bodyDark}"/>
      <path d="M${sx * 10} 0 Q${sx * 36} 2 ${sx * 40} 26 Q${sx * 24} 34 ${sx * 8} 26 Z" fill="${C.body}" opacity=".8"/>
    </g>`;
  };
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="${size}" height="${size}" class="eagle eagle-${mood}" aria-hidden="true">
  <g class="eagle-wing-l">${wing("l", wingL)}</g>
  <g class="eagle-wing-r">${wing("r", wingR)}</g>
  <path d="M74 186 L84 164 L96 186 Z" fill="${C.bodyDark}"/><path d="M104 186 L116 164 L126 186 Z" fill="${C.bodyDark}"/>
  <ellipse cx="100" cy="135" rx="54" ry="50" fill="${C.body}"/>
  <ellipse cx="100" cy="146" rx="36" ry="34" fill="${C.belly}"/>
  <path d="M84 150 q6 10 16 0 M100 160 q6 10 16 0 M84 168 q6 10 16 0" stroke="#e5d6bd" stroke-width="2" fill="none"/>
  <g transform="translate(0 2)"><path d="M78 184 l-10 10 M78 184 l0 12 M78 184 l10 10" stroke="${C.foot}" stroke-width="5" stroke-linecap="round"/>
  <path d="M122 184 l-10 10 M122 184 l0 12 M122 184 l10 10" stroke="${C.foot}" stroke-width="5" stroke-linecap="round"/></g>
  <g class="eagle-head">
    ${crest}
    <circle cx="100" cy="84" r="42" fill="${C.face}"/>
    <path d="M62 96 q38 -20 76 0 q-10 -30 -38 -30 q-28 0 -38 30 Z" fill="#efe1c7" opacity=".6"/>
    <circle cx="70" cy="96" r="6" fill="${C.cheek}" opacity=".7"/><circle cx="130" cy="96" r="6" fill="${C.cheek}" opacity=".7"/>
    ${brows}${eyes}
    <path d="M90 92 Q100 88 110 92 Q112 108 100 118 Q88 108 90 92 Z" fill="${C.beak}"/>
    <path d="M94 93 Q100 90 106 93 Q104 100 100 102 Q96 100 94 93 Z" fill="${C.beakLight}"/>
    ${mouth}
  </g>
  ${extra}
</svg>`;
}

export function eagle(mood, size = 120, cls = "") {
  return h("div", { class: ("mascot " + cls).trim(), html: eagleSvg(mood, size) });
}

/** Sprechblase mit Adler daneben. */
export function eagleSays(mood, text, { size = 96, cls = "" } = {}) {
  return h("div", { class: ("mascot-row " + cls).trim() },
    eagle(mood, size),
    h("div", { class: "bubble" }, text),
  );
}

// ---------- Unit-Abzeichen ----------
const BADGES = {
  1: `<path d="M22 36 v-14 a3 3 0 0 1 6 0 v8 v-12 a3 3 0 0 1 6 0 v12 v-10 a3 3 0 0 1 6 0 v10 v-6 a3 3 0 0 1 6 0 v14 a12 12 0 0 1 -12 12 h-2 a12 12 0 0 1 -10 -6 l-7 -11 a3 3 0 0 1 5 -4 z" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/>`, // winkende Hand
  2: `<circle cx="24" cy="24" r="7" fill="none" stroke="currentColor" stroke-width="3"/><circle cx="42" cy="26" r="5" fill="none" stroke="currentColor" stroke-width="3"/><path d="M12 48 a12 12 0 0 1 24 0 M34 48 a9 9 0 0 1 17 -3" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>`, // Familie
  3: `<path d="M12 30 h40 a20 20 0 0 1 -40 0 z" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="M24 16 q4 6 0 10 M34 14 q4 6 0 10 M44 16 q4 6 0 10" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>`, // Schüssel
  4: `<circle cx="32" cy="32" r="20" fill="none" stroke="currentColor" stroke-width="3"/><path d="M32 18 v14 l9 6" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>`, // Uhr
  5: `<path d="M12 32 L32 14 L52 32 M18 28 v22 h28 v-22" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="M28 50 v-12 h8 v12" fill="none" stroke="currentColor" stroke-width="3"/>`, // Haus
  6: `<circle cx="26" cy="26" r="9" fill="none" stroke="currentColor" stroke-width="3"/><path d="M26 10 v4 M26 38 v4 M10 26 h4 M38 26 h4 M15 15 l3 3 M34 15 l-3 3" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M30 50 h18 a7 7 0 0 0 0 -14 a10 10 0 0 0 -19 3 a6 6 0 0 0 1 11 z" fill="var(--card)" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/>`, // Sonne + Wolke
  7: `<rect x="10" y="14" width="44" height="30" rx="3" fill="none" stroke="currentColor" stroke-width="3"/><path d="M18 24 h18 M18 32 h26 M26 44 v8 M38 44 v8 M20 52 h24" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>`, // Tafel
  8: `<path d="M10 32 h44 M44 22 l10 10 l-10 10" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><circle cx="18" cy="32" r="4" fill="currentColor"/><circle cx="32" cy="32" r="4" fill="currentColor"/>`, // Zeitstrahl
  9: `<path d="M22 24 a10 10 0 1 1 14 9 q-4 2 -4 7" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/><circle cx="32" cy="50" r="2.5" fill="currentColor"/>`, // Fragezeichen
  10: `<path d="M8 40 v-12 a4 4 0 0 1 4 -4 h36 l8 8 v8 z" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="M8 40 h48 M18 32 h8 M30 32 h8" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><circle cx="20" cy="44" r="4" fill="var(--card)" stroke="currentColor" stroke-width="3"/><circle cx="44" cy="44" r="4" fill="var(--card)" stroke="currentColor" stroke-width="3"/>`, // Jeepney
  11: `<path d="M16 12 h26 a6 6 0 0 1 6 6 v34 h-28 a4 4 0 0 1 -4 -4 z M16 12 a4 4 0 0 0 -4 4 v30 a4 4 0 0 0 4 4" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="M24 24 h16 M24 32 h16 M24 40 h10" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>`, // Buch/Geschichte
  12: `<path d="M32 52 L14 34 a10 10 0 0 1 14 -14 l4 4 l4 -4 a10 10 0 0 1 14 14 z" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/>`, // Herz
};

/** Abzeichen einer Unit. state: "done" | "open" | "locked" */
export function unitBadge(unit, state = "open", size = 44) {
  const path = BADGES[unit] || `<text x="32" y="40" text-anchor="middle" font-size="24" font-weight="700" fill="currentColor" font-family="sans-serif">${unit}</text>`;
  return h("div", { class: "ubadge " + state, style: { width: size + "px", height: size + "px" }, html:
    `<svg viewBox="0 0 64 64" width="${size}" height="${size}" aria-hidden="true">${path}</svg>` });
}

// ---------- Konfetti ----------
export function confetti(count = 70, ms = 2600) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const colors = ["#f59e0b", "#0ea5e9", "#16a34a", "#ec4899", "#8b5cf6", "#eab308", "#2dd4bf"];
  const wrap = h("div", { class: "confetti", "aria-hidden": "true" });
  for (let i = 0; i < count; i++) {
    const d = (Math.random() * 0.8).toFixed(2) + "s";
    const dur = (1.6 + Math.random() * 1.2).toFixed(2) + "s";
    wrap.append(h("i", { style: {
      left: Math.random() * 100 + "%", background: colors[i % colors.length],
      animationDelay: d, animationDuration: dur,
      width: 6 + Math.random() * 6 + "px", height: 8 + Math.random() * 8 + "px",
      transform: `rotate(${Math.random() * 360}deg)`,
      borderRadius: Math.random() < 0.3 ? "50%" : "2px",
    } }));
  }
  document.body.append(wrap);
  setTimeout(() => wrap.remove(), ms + 1200);
}

/** Zufälliger Spruch des Adlers für die Startseite. */
export function homeLine({ streak, lessonsToday, dailyGoal, dueCount, inProgress, allDone }) {
  if (allDone) return "Human na! Alle Lektionen geschafft. Ich bleibe trotzdem hier und passe auf deinen Wortschatz auf.";
  if (inProgress) return "Du hast noch eine Lektion offen. Lass sie uns zu Ende bringen!";
  if (lessonsToday >= dailyGoal && dailyGoal > 0) return pick(["Tagesziel geschafft – maayo kaayo! Noch eine Runde?", "Fertig für heute! Oder hast du noch Lust auf eine Extra-Lektion?"]);
  if (dueCount >= 10) return `${dueCount} Wörter warten auf Wiederholung. Erst die, dann Neues?`;
  if (streak >= 7) return pick([`${streak} Tage am Stück – das macht Eindruck in Cebu!`, "Du bist richtig dran. Weiter so!"]);
  if (lessonsToday === 0) return pick(["Bereit? Eine Lektion dauert nur ein paar Minuten.", "Kumusta? Lass uns was Neues lernen.", "Heute schon Cebuano gesprochen? Fangen wir an."]);
  return pick(["Weiter geht's – deine Frau wird staunen.", "Sige, noch eine Lektion!"]);
}
function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
