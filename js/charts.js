// Schlichte SVG-Diagramme ohne Bibliothek. Alle Funktionen liefern einen SVG-String.
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/**
 * Liniendiagramm.
 * @param {Array<{label:string, values:Array<number|null>, color:string}>} series
 * @param {string[]} labels  x-Beschriftungen (gleiche Länge wie values)
 * @param {{yMax?:number, yMin?:number, unit?:string, height?:number}} opts
 */
export function lineChart(series, labels, opts = {}) {
  const W = 320, H = opts.height || 160, padL = 30, padR = 8, padT = 10, padB = 22;
  const n = labels.length;
  const allVals = series.flatMap((s) => s.values.filter((v) => v != null));
  const yMax = opts.yMax ?? Math.max(1, ...allVals);
  const yMin = opts.yMin ?? 0;
  const x = (i) => padL + (n <= 1 ? 0 : (i * (W - padL - padR)) / (n - 1));
  const y = (v) => padT + (H - padT - padB) * (1 - (v - yMin) / Math.max(1e-9, yMax - yMin));
  let out = `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img">`;
  // Gitter
  for (let g = 0; g <= 4; g++) {
    const v = yMin + ((yMax - yMin) * g) / 4;
    out += `<line x1="${padL}" x2="${W - padR}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" class="grid"/>`;
    out += `<text x="${padL - 4}" y="${(y(v) + 3).toFixed(1)}" class="axis" text-anchor="end">${Math.round(v)}${opts.unit || ""}</text>`;
  }
  // x-Labels (jedes zweite bei vielen Punkten)
  labels.forEach((l, i) => {
    if (n > 8 && i % 2 === 1) return;
    out += `<text x="${x(i).toFixed(1)}" y="${H - 6}" class="axis" text-anchor="middle">${esc(l)}</text>`;
  });
  for (const s of series) {
    let d = "", started = false;
    s.values.forEach((v, i) => {
      if (v == null) { started = false; return; }
      d += `${started ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
      started = true;
    });
    out += `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>`;
    s.values.forEach((v, i) => {
      if (v == null) return;
      out += `<circle cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="3" fill="${s.color}"/>`;
    });
  }
  out += "</svg>";
  if (series.length > 1) {
    out += `<div class="legend">${series.map((s) => `<span><i style="background:${s.color}"></i>${esc(s.label)}</span>`).join("")}</div>`;
  }
  return out;
}

/** Gestapelter horizontaler Balken. segments: [{label, value, color}] */
export function stackedBar(segments) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  let out = `<div class="stackbar">`;
  for (const s of segments) {
    const w = (s.value / total) * 100;
    if (w <= 0) continue;
    out += `<div style="width:${w.toFixed(2)}%;background:${s.color}" title="${esc(s.label)}: ${s.value}"></div>`;
  }
  out += `</div><div class="legend">${segments.map((s) => `<span><i style="background:${s.color}"></i>${esc(s.label)} <b>${s.value}</b></span>`).join("")}</div>`;
  return out;
}

/** Gestapeltes Flächendiagramm über die Zeit (SRS-Verlauf). rows: [{date, neu, lernend, ...}] */
export function stackedArea(rows, keys, colors, labels) {
  const W = 320, H = 140, padL = 30, padR = 8, padT = 8, padB = 20;
  const n = rows.length;
  const totals = rows.map((r) => keys.reduce((s, k) => s + (r[k] || 0), 0));
  const yMax = Math.max(1, ...totals);
  const x = (i) => padL + (i * (W - padL - padR)) / Math.max(1, n - 1);
  const y = (v) => padT + (H - padT - padB) * (1 - v / yMax);
  let out = `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img">`;
  for (let g = 0; g <= 2; g++) {
    const v = (yMax * g) / 2;
    out += `<text x="${padL - 4}" y="${(y(v) + 3).toFixed(1)}" class="axis" text-anchor="end">${Math.round(v)}</text>`;
  }
  const cum = rows.map(() => 0);
  keys.forEach((k, ki) => {
    let top = "", bottom = "";
    rows.forEach((r, i) => {
      const b = cum[i];
      const t = b + (r[k] || 0);
      top += `${i ? "L" : "M"}${x(i).toFixed(1)},${y(t).toFixed(1)}`;
      bottom = `L${x(i).toFixed(1)},${y(b).toFixed(1)}` + bottom;
      cum[i] = t;
    });
    out += `<path d="${top}${bottom}Z" fill="${colors[ki]}" opacity="0.9"/>`;
  });
  [0, Math.floor(n / 2), n - 1].forEach((i) => {
    if (rows[i]) out += `<text x="${x(i).toFixed(1)}" y="${H - 5}" class="axis" text-anchor="${i === 0 ? "start" : i === n - 1 ? "end" : "middle"}">${esc(rows[i].date.slice(8, 10) + "." + rows[i].date.slice(5, 7) + ".")}</text>`;
  });
  out += "</svg>";
  out += `<div class="legend">${keys.map((k, i) => `<span><i style="background:${colors[i]}"></i>${esc(labels[i])}</span>`).join("")}</div>`;
  return out;
}

/** Kalender-Heatmap (12 Wochen, Montag oben). days: [{date, count, active, future}] */
export function heatmap(days) {
  const weeks = Math.ceil(days.length / 7);
  const cell = 14, gap = 3, padL = 22, padT = 14;
  const W = padL + weeks * (cell + gap), H = padT + 7 * (cell + gap);
  const max = Math.max(1, ...days.map((d) => d.count));
  let out = `<svg viewBox="0 0 ${W} ${H}" class="chart heat" role="img">`;
  ["Mo", "Mi", "Fr"].forEach((l, i) => {
    out += `<text x="0" y="${padT + [0, 2, 4][i] * (cell + gap) + cell - 3}" class="axis">${l}</text>`;
  });
  days.forEach((d, i) => {
    const w = Math.floor(i / 7), r = i % 7;
    const x = padL + w * (cell + gap), y = padT + r * (cell + gap);
    let cls = "h0";
    if (d.future) cls = "hf";
    else if (d.count > 0 || d.active) {
      const lvl = Math.ceil((d.count / max) * 4) || 1;
      cls = "h" + Math.max(1, Math.min(4, lvl));
    }
    if (r === 0 && d.date.slice(8, 10) <= "07") out += `<text x="${x}" y="${padT - 4}" class="axis">${d.date.slice(5, 7)}.</text>`;
    out += `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" rx="3" class="${cls}"><title>${d.date}: ${d.count} Übungen</title></rect>`;
  });
  out += "</svg>";
  return out;
}

/** Einfache horizontale Balkenliste. items: [{label, value(0-100), text}] */
export function barList(items, color) {
  return `<div class="barlist">${items
    .map((it) => `<div class="barrow"><span class="barlabel">${esc(it.label)}</span><span class="bar"><i style="width:${Math.max(0, Math.min(100, it.value || 0))}%;background:${color || "var(--accent)"}"></i></span><span class="barval">${esc(it.text ?? (it.value == null ? "–" : it.value + " %"))}</span></div>`)
    .join("")}</div>`;
}
