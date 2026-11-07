// Verwechsler: Wörter, die gleich klingen oder zusammengehören (Pronomen, hier/da/dort, dili/wala …).
// Mit Muster-Erklärung und Eselsbrücken; alle Wörter kommen aus dem Glossar.
import { h, replace } from "./ui.js";
import { pronounce } from "./pronounce.js";

// Pronomen-Tabelle: [Person, Langform, Kurzform, mein/dein (-ng), mir/dir (n-)]
const PRONOUNS = [
  { de: "ich", long: "ako", short: "ko", poss: "akong", obj: "nako", hook: "ako/ko: A-KO = „Ah, KOmm, ich“. Kurzform ko hängt hinten dran: Maestro ko." },
  { de: "du", long: "ikaw", short: "ka", poss: "imong", obj: "nimo", hook: "ikaw/ka: i-KAU klingt wie „ich kau“, gemeint bist aber DU – die Falle merken! Kurz: ka." },
  { de: "er / sie", long: "siya", short: "siya", poss: "iyang", obj: "niya", hook: "siya: „SIEH JA, da ist er/sie“. Eine Form für beide, keine Kurzform." },
  { de: "wir – du und ich", long: "kita", short: "ta", poss: "atong", obj: "nato", hook: "kita = KITA: alle sind drin, auch du. ta = TAndem: du und ich. Kaon ta! = Lass uns (beide) essen." },
  { de: "wir – ohne dich", long: "kami", short: "mi", poss: "among", obj: "namo", hook: "kami = „wir KAMen ohne dich“. mi = MIr und meine Leute, du nicht. Aleman mi = Wir sind Deutsche (du nicht)." },
  { de: "ihr", long: "kamo", short: "mo", poss: "inyong", obj: "ninyo", hook: "kamo = „KOMMt ihr?“ – kamo, ihr alle. Kurz: mo." },
  { de: "sie (mehrere)", long: "sila", short: "sila", poss: "ilang", obj: "nila", hook: "sila = SIe aLle: alle sitzen im SILo. Keine Kurzform." },
];

const GROUPS = [
  {
    title: "Das Muster hinter allen Pronomen",
    emoji: "🧩",
    text: "Jede Person hat vier Formen, und die bauen sich immer gleich: Langform am Satzanfang (Ako si Tim), Kurzform hinten im Satz (Maestro ko), Besitz mit -ng (akong = mein), und die n-Form für mir/mich/von mir (Salamat nimo = Danke dir).",
    hooks: [
      "-ng = gehört jemandem: akoNG, imoNG, iyaNG, atoNG, amoNG, inyoNG, ilaNG. Merke: aNGehörig = es gehört dazu.",
      "n- vorne = Nehmer: Nako, Nimo, Niya, Nato, Namo, Ninyo, Nila. Steht NACH dem Verb oder Nomen: amigo nako = Freund von mir.",
      "Kurzform = Anhänger: ko, ka, ta, mi, mo hängen sich an das erste Wort: Maayo ra ko. Taga-Cebu ka?",
    ],
    table: true,
  },
  {
    title: "Wir mit dir, wir ohne dich",
    emoji: "👥",
    text: "Cebuano hat zwei „wir“. kita/ta schließt die Person ein, mit der du sprichst. kami/mi schließt sie aus.",
    hooks: [
      "Zu Langga sagst du fast immer ta/kita: Kaon ta! (Lass uns beide essen), atong anak (unser Kind – deins und meins).",
      "Zu Lola über euch beide sagst du mi/kami: Nagpuyo mi sa Sauerland (Wir wohnen im Sauerland – Lola nicht), among balay (unser Haus – nicht deins).",
      "KITA = KITA, alle Kinder drin. KAMI = wir KAMen ohne dich.",
    ],
    words: ["kita", "ta", "atong", "nato", "kami", "mi", "among", "namo"],
  },
  {
    title: "Kurzformen mit angehängtem Wort",
    emoji: "✂️",
    text: "Im Alltag kleben kleine Wörter zusammen. koy = ko + y (das y ersetzt ug), kog = ko + ug, tika = ko ikaw (ich … dich).",
    hooks: [
      "Naa koy anak = Naa ko ug anak (Ich habe ein Kind). Das y ist nur ein geschrumpftes ug.",
      "Gusto kog kape = Gusto ko ug kape. kog = ko + ug, wieder ein geschrumpftes ug.",
      "tika = ich … dich: Gihigugma tika = Ich liebe dich. Merke: TIcket für dich.",
    ],
    words: ["ko", "ug", "tika", "naa"],
  },
  {
    title: "hier – da – dort: i, a, o",
    emoji: "📍",
    text: "Die Vokale verraten die Entfernung: i = hier bei mir, a = da bei dir, o = dort drüben. Das gilt für „dies/das“ und für „hier/dort“.",
    hooks: [
      "kIni = das hier (bei mir), kAna = das da (bei dir), kAdtO = jenes dort (weit weg). Kurz: ni, na, to.",
      "dInhi = hier, dIdtO = dort. Merke die Reihe i → a → o wie „ich → anderer → oben weit weg“.",
      "Vorsicht: na heißt auch „schon“. Katloan ko na = Ich bin schon 30. Unsa na? = Was ist das da?",
    ],
    words: ["kini", "kana", "kadto", "dinhi", "didto", "na"],
  },
  {
    title: "dili oder wala",
    emoji: "🚫",
    text: "Zwei Neins. dili = nicht so, nicht tun (Zukunft, Eigenschaften). wala = nicht da, nicht passiert (Besitz, Vergangenheit).",
    hooks: [
      "DILI ko maestro = Ich bin kein Lehrer. DILI ko mokaon = Ich werde nicht essen. Merke: DILI = „das ist nicht so“.",
      "WALA ko ug kwarta = Ich habe kein Geld. WALA ko nikaon = Ich habe nicht gegessen. Merke: WALA = „weg, nicht da“.",
      "Antwort auf Salamat: Walay sapayan = kein Schaden (wala + y).",
    ],
    words: ["dili", "wala", "Walay sapayan"],
  },
  {
    title: "na oder pa",
    emoji: "⏳",
    text: "na = schon / jetzt. pa = noch. Beide hängen hinter dem ersten Wort.",
    hooks: [
      "Katloan ko NA = Ich bin schon 30. Wala PA = noch nicht. Merke: NA = „na endlich, schon“, PA = „pah, noch nicht“.",
      "Gamay pa siya = Sie ist noch klein. Dako na siya = Sie ist schon groß.",
    ],
    words: ["na", "pa"],
  },
  {
    title: "si, ni, kang, sa, ug – die kleinen Marker",
    emoji: "🏷️",
    text: "Vor Namen und Dingen stehen winzige Wörter, die sagen, welche Rolle das Folgende hat.",
    hooks: [
      "si = die Person selbst: Kini si Mama = Das ist Mama. ni = von der Person: balay ni Mama = Mamas Haus. Merke: SI = SIe selbst, NI = von ihr.",
      "kang = für/an eine Person: para kang Mama = für Mama. sa = in/an/zu einem Ort oder einer Zeit: sa balay, sa Lunes.",
      "ug = und, aber auch „ein/eine“ vor dem Objekt: Gusto ko ug kape = Ich möchte einen Kaffee. Nie og schreiben.",
    ],
    words: ["si", "ni", "kang", "sa", "ug"],
  },
];

export const CONFUSABLE_WORDS = [...new Set([
  ...PRONOUNS.flatMap((p) => [p.long, p.short, p.poss, p.obj]),
  ...GROUPS.flatMap((g) => g.words || []),
])];

export function renderConfusables(main, { content, navigate }) {
  const known = (ceb) => !!content.entry(ceb);
  const cell = (w) => h("button", { class: "ptab-cell", onclick: () => navigate("#trainer/preset?mode=easy&words=" + encodeURIComponent(w)) }, h("b", {}, w), h("span", { class: "pron" }, pronounce(w)));
  const table = h("div", { class: "ptab" },
    h("div", { class: "ptab-row head" }, h("span", {}, ""), h("span", {}, "lang"), h("span", {}, "kurz"), h("span", {}, "mein/dein (-ng)"), h("span", {}, "mir/dir (n-)")),
    PRONOUNS.map((p) => h("div", { class: "ptab-row" }, h("span", { class: "ptab-de" }, p.de), cell(p.long), p.short === p.long ? h("span", { class: "muted small center" }, "–") : cell(p.short), cell(p.poss), cell(p.obj))),
  );
  const practice = (words, label) => {
    const ws = words.filter(known);
    return ws.length ? h("button", { class: "btn-small btn-outline mt", onclick: () => navigate("#trainer/preset?mode=easy&words=" + encodeURIComponent(ws.join("|"))) }, label || `Diese ${ws.length} Wörter üben`) : null;
  };
  replace(main,
    h("h1", {}, "Verwechsler"),
    h("p", { class: "muted" }, "Die kleinen Wörter, die alle gleich klingen: ako, akong, nako … Hier stehen sie nebeneinander, mit dem Muster dahinter und Eselsbrücken. Tipp auf ein Wort startet eine kurze Übung dazu."),
    GROUPS.map((g) => h("div", { class: "card" },
      h("h3", { style: { marginTop: 0 } }, g.emoji + " " + g.title),
      h("p", {}, g.text),
      g.table ? table : null,
      g.table ? PRONOUNS.map((p) => h("div", { class: "mnemo" }, "💡 ", p.hook)) : null,
      g.hooks.map((t) => h("div", { class: "mnemo" }, "💡 ", t)),
      g.table ? practice(PRONOUNS.flatMap((p) => [p.long, p.short, p.poss, p.obj]), "Alle Pronomen üben") : practice(g.words),
    )),
    h("button", { class: "btn-primary btn-block btn-big mt", onclick: () => navigate("#trainer/preset?mode=hard&words=" + encodeURIComponent(CONFUSABLE_WORDS.filter(known).join("|"))) }, "Alle Verwechsler üben (tippen)"),
  );
  main.scrollTop = 0;
}
