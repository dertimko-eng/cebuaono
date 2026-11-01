// Figuren der Geschichten als kleine SVG-Porträts (Inline, kein Bild nötig).
import { h } from "./ui.js";
import { eagleSvg } from "./art.js";

export const CHARACTERS = {
  tim: { name: "Tim", color: "#0ea5e9" },
  langga: { name: "Langga", color: "#ec4899" },
  inday: { name: "Inday", color: "#f59e0b" },
  lola: { name: "Lola", color: "#8b5cf6" },
  dodong: { name: "Manong Dodong", color: "#16a34a" },
  agila: { name: "Agila", color: "#0f766e" },
};

const SKIN = { light: "#f3d3b8", tan: "#d9a579", brown: "#b97a4b" };

function face({ skin, hair, extra = "", mouth = "smile" }) {
  const m = mouth === "smile" ? `<path d="M40 64 q10 9 20 0" stroke="#7a3b2e" stroke-width="3" fill="none" stroke-linecap="round"/>`
    : mouth === "grin" ? `<path d="M38 62 q12 14 24 0 z" fill="#7a3b2e"/><path d="M42 63 q8 5 16 0" fill="#fff"/>`
    : `<path d="M42 66 h16" stroke="#7a3b2e" stroke-width="3" stroke-linecap="round"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" aria-hidden="true">
  <circle cx="50" cy="50" r="48" fill="#e8eef3"/>
  <path d="M20 100 q30 -35 60 0 z" fill="#5b6b7a"/>
  ${hair.back || ""}
  <ellipse cx="50" cy="52" rx="24" ry="27" fill="${skin}"/>
  ${hair.front || ""}
  <circle cx="41" cy="50" r="3" fill="#222"/><circle cx="59" cy="50" r="3" fill="#222"/>
  <circle cx="35" cy="59" r="4" fill="#f4a9a0" opacity=".6"/><circle cx="65" cy="59" r="4" fill="#f4a9a0" opacity=".6"/>
  <path d="M47 55 q3 4 6 0" stroke="#c98a6a" stroke-width="2" fill="none"/>
  ${m}${extra}
</svg>`;
}

const PORTRAITS = {
  tim: () => face({
    skin: SKIN.light,
    hair: { front: `<path d="M26 44 q24 -30 48 0 q-4 -14 -24 -16 q-20 2 -24 16 z" fill="#8a5a35"/>` },
    extra: `<circle cx="41" cy="50" r="7" fill="none" stroke="#333" stroke-width="2"/><circle cx="59" cy="50" r="7" fill="none" stroke="#333" stroke-width="2"/><path d="M48 50 h4" stroke="#333" stroke-width="2"/>
            <path d="M34 66 q16 16 32 0 q-16 8 -32 0 z" fill="#8a5a35" opacity=".5"/>`,
  }),
  langga: () => face({
    skin: SKIN.tan,
    hair: { back: `<path d="M24 50 q0 -34 26 -34 q26 0 26 34 v40 h-52 z" fill="#1f1a17"/>`, front: `<path d="M26 46 q10 -26 24 -22 q16 -4 24 22 q-8 -12 -24 -12 q-16 0 -24 12 z" fill="#1f1a17"/>` },
    extra: `<circle cx="72" cy="38" r="5" fill="#ec4899"/><circle cx="77" cy="44" r="4" fill="#f59e0b"/>`,
    mouth: "grin",
  }),
  inday: () => face({
    skin: SKIN.tan,
    hair: { back: `<circle cx="22" cy="40" r="10" fill="#1f1a17"/><circle cx="78" cy="40" r="10" fill="#1f1a17"/>`, front: `<path d="M27 46 q6 -24 23 -22 q17 -2 23 22 q-6 -10 -23 -10 q-17 0 -23 10 z" fill="#1f1a17"/><circle cx="22" cy="40" r="4" fill="#ec4899"/><circle cx="78" cy="40" r="4" fill="#ec4899"/>` },
    extra: `<circle cx="41" cy="50" r="3.6" fill="#222"/><circle cx="59" cy="50" r="3.6" fill="#222"/>`,
    mouth: "grin",
  }),
  lola: () => face({
    skin: SKIN.brown,
    hair: { back: `<circle cx="50" cy="26" r="12" fill="#d9d9d9"/>`, front: `<path d="M26 46 q8 -22 24 -20 q16 -2 24 20 q-8 -8 -24 -8 q-16 0 -24 8 z" fill="#d9d9d9"/>` },
    extra: `<circle cx="41" cy="50" r="7" fill="none" stroke="#6b4a2b" stroke-width="2"/><circle cx="59" cy="50" r="7" fill="none" stroke="#6b4a2b" stroke-width="2"/><path d="M48 50 h4 M30 42 l8 -3 M70 42 l-8 -3" stroke="#6b4a2b" stroke-width="2"/>
            <path d="M36 62 q14 10 28 0" stroke="#7a3b2e" stroke-width="3" fill="none" stroke-linecap="round"/>`,
    mouth: "none",
  }),
  dodong: () => face({
    skin: SKIN.brown,
    hair: { front: `<path d="M24 46 q4 -24 26 -24 q22 0 26 24 z" fill="#16a34a"/><path d="M22 46 h56 l6 6 h-68 z" fill="#15803d"/>` },
    extra: `<path d="M38 70 q12 6 24 0" stroke="#7a3b2e" stroke-width="2" fill="none"/>`,
    mouth: "grin",
  }),
  agila: () => eagleSvg("idle", 100),
};

export function portrait(who, size = 44) {
  const fn = PORTRAITS[who] || PORTRAITS.tim;
  return h("div", { class: "portrait " + who, style: { width: size + "px", height: size + "px" }, html: fn() });
}

export function characterName(who) {
  return CHARACTERS[who]?.name || who;
}
