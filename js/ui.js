// Kleine DOM-Helfer.
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k === "html") el.innerHTML = v;
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else if (k === "style" && typeof v === "object") Object.assign(el.style, v);
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

export function frag(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content;
}

let toastTimer = null;
export function toast(msg, ms = 2200) {
  document.querySelectorAll(".toast").forEach((t) => t.remove());
  const t = h("div", { class: "toast", role: "status", "aria-live": "polite" }, msg);
  document.body.append(t);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.remove(), ms);
}

export function sheet(contentEl, { onClose } = {}) {
  const overlay = h("div", { class: "overlay" });
  const closeBtn = h("button", { class: "btn-ghost btn-icon sheet-close", "aria-label": "Schließen", onclick: () => close() }, "✕");
  const s = h("div", { class: "sheet", role: "dialog", "aria-modal": "true" }, closeBtn, contentEl);
  overlay.append(s);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });
  const onKey = (e) => { if (e.key === "Escape") close(); };
  document.addEventListener("keydown", onKey);
  function close() { document.removeEventListener("keydown", onKey); overlay.remove(); onClose && onClose(); }
  document.body.append(overlay);
  return { close, el: s };
}

export function confirmSheet(text, { okLabel = "Ja", cancelLabel = "Abbrechen", danger = false } = {}) {
  return new Promise((resolve) => {
    const c = h("div", {},
      h("p", { style: { fontSize: "18px", marginBottom: "16px" } }, text),
      h("button", { class: "btn-block " + (danger ? "btn-danger" : "btn-primary"), onclick: () => { s.close(); resolve(true); } }, okLabel),
      h("button", { class: "btn-block btn-ghost mt", onclick: () => { s.close(); resolve(false); } }, cancelLabel),
    );
    const s = sheet(c, { onClose: () => resolve(false) });
  });
}

export function shuffle(arr, rnd = Math.random) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function fmtMinutes(min) {
  if (min == null) return "–";
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h ${min % 60} min`;
}

export function fmtTime(ts) {
  if (!ts) return "nie";
  const d = new Date(ts);
  return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" }) + " " + d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
}

export function isStandalone() {
  return window.navigator.standalone === true || window.matchMedia("(display-mode: standalone)").matches;
}

export function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    toast("Kopiert.");
  } catch (_) {
    toast("Kopieren nicht möglich – bitte markieren und kopieren.");
  }
}

// Ersetzt die Kinder eines Elements; Arrays werden geglättet, null/false übersprungen.
export function replace(el, ...kids) {
  el.replaceChildren(...kids.flat(Infinity).filter((c) => c != null && c !== false));
}
