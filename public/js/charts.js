// Hand-drawn SVG charts. Curves draw themselves, dots pop in, hovers show real numbers (via data-tip).
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

export const CURVE = (t) => Math.exp(-Math.pow((t - 0.7) / (t < 0.7 ? 0.27 : 0.2), 2));
const BANDS = [
  { name: "Introduction", a: 0, b: 0.2 }, { name: "Growth", a: 0.2, b: 0.58 },
  { name: "Maturity", a: 0.58, b: 0.82 }, { name: "Decline", a: 0.82, b: 1 },
];

/* ------------------------------------------------------------------ life-cycle curve */
// markers: [{ id, label, t, primary, tip }]. opts.mini draws a small version with only the primary marker.
export function plcChart(markers, { w = 900, h = 330, compact = false, mini = false, live = false } = {}) {
  if (mini) { w = 360; h = 190; }
  const L = 24, R = 24, T = mini ? 18 : 42, B = mini ? 30 : 46, iw = w - L - R, ih = h - T - B;
  const X = (t) => L + t * iw, Y = (t) => T + (1 - CURVE(t) * 0.92) * ih;
  let d = "";
  for (let i = 0; i <= 120; i++) { const t = i / 120; d += (i ? " L" : "M") + X(t).toFixed(1) + " " + Y(t).toFixed(1); }
  let s = `<svg class="plc draw ${mini ? "mini" : ""}" viewBox="0 0 ${w} ${h}" role="img" aria-label="Product life-cycle curve">`;
  s += `<defs><linearGradient id="plcfill${mini ? "m" : ""}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--accent)" stop-opacity=".5"/><stop offset="1" stop-color="var(--accent)" stop-opacity="0"/></linearGradient></defs>`;
  BANDS.forEach((b, i) => {
    s += `<rect class="plc-bandbg" x="${X(b.a)}" y="${T - 12}" width="${(b.b - b.a) * iw}" height="${ih + 12}" opacity="${i % 2 ? 0.05 : 0.1}" style="--i:${i}"/>`;
    s += `<text x="${X((b.a + b.b) / 2)}" y="${h - (mini ? 10 : 16)}" text-anchor="middle" class="plc-band ${mini ? "sm" : ""}">${mini ? b.name.slice(0, 5) + "." : b.name}</text>`;
  });
  s += `<path class="plc-area" d="${d} L${X(1)} ${T + ih} L${X(0)} ${T + ih}Z" fill="url(#plcfill${mini ? "m" : ""})"/>`;
  s += `<path class="plc-line" pathLength="1" d="${d}" fill="none" stroke="var(--accent)" stroke-width="${mini ? 2.4 : 3.2}" stroke-linecap="round"/>`;

  const rects = markers.filter((m) => !mini || m.primary).map((m) => ({ x0: X(m.t) - 8, x1: X(m.t) + 8, y0: Y(m.t) - 8, y1: Y(m.t) + 8 }));
  const hit = (a, b) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
  const fs = compact ? 11 : 12;
  let idx = 0;
  [...markers].sort((a, b) => a.t - b.t).forEach((m) => {
    const x = X(m.t), y = Y(m.t);
    if (m.primary && live) {
      s += `<g class="mk" style="transform:translate(${x.toFixed(1)}px,${y.toFixed(1)}px);opacity:${m.hidden ? 0 : 1}"><circle r="20" fill="var(--accent-2)" opacity=".22" class="pulse"/><circle r="8" fill="var(--accent-2)" stroke="var(--bg)" stroke-width="3"/></g>`;
      return;
    }
    if (m.primary) {
      s += `<g class="mk" style="transform:translate(${x.toFixed(1)}px,${y.toFixed(1)}px)" data-tip="${esc(m.tip || m.label)}">`;
      s += `<circle r="22" fill="var(--accent-2)" opacity=".2" class="pulse"/><circle r="9" fill="var(--accent-2)" stroke="var(--bg)" stroke-width="3"/>`;
      s += `<line x1="0" y1="-12" x2="0" y2="${-(y - T + 24).toFixed(1)}" stroke="var(--accent-2)" stroke-width="1.5" stroke-dasharray="3 4"/>`;
      s += `<text y="${-(y - T + 32).toFixed(1)}" text-anchor="middle" class="plc-you">${esc(m.label)}</text></g>`;
      return;
    }
    if (mini) return;
    s += `<circle class="plc-dot pop" style="--i:${idx}" cx="${x}" cy="${y}" r="6" data-id="${esc(m.id)}" data-tip="${esc(m.tip || m.label)}"/>`;
    const w2 = m.label.length * fs * 0.56 + 6;
    let placed = null;
    for (const side of [-1, 1]) {
      for (let k = 0; k < 9 && !placed; k++) {
        const ly = y - 12 - k * (fs + 3);
        const r = { x0: side < 0 ? x - w2 - 6 : x + 6, x1: side < 0 ? x - 6 : x + w2 + 6, y0: ly - fs, y1: ly + 3 };
        if (r.x0 >= 0 && r.x1 <= w && r.y0 > 6 && !rects.some((q) => hit(r, q))) placed = { r, ly, anchor: side < 0 ? "end" : "start", lx: side < 0 ? x - 8 : x + 8 };
      }
      if (placed) break;
    }
    placed ||= { r: null, ly: y - 14, anchor: "middle", lx: x };
    if (placed.r) rects.push(placed.r);
    s += `<text class="plc-lbl pop" style="--i:${idx}" x="${placed.lx}" y="${placed.ly}" text-anchor="${placed.anchor}" data-id="${esc(m.id)}">${esc(m.label)}</text>`;
    idx++;
  });
  return s + "</svg>";
}
export const plcXY = (t, w = 360, h = 190) => ({ x: 24 + t * (w - 48), y: 18 + (1 - CURVE(t) * 0.92) * (h - 48) });

/* ------------------------------------------------------------------ radar */
// metrics: [{ short, data:{score}, student }]. opts.showData=false hides the data polygon (used while quizzing).
export function radarChart(metrics, { size = 380, showData = true, mini = false } = {}) {
  const c = size / 2, R = size / 2 - (mini ? 52 : 64), n = metrics.length;
  const ang = (i) => -Math.PI / 2 + (i * 2 * Math.PI) / n;
  const pt = (i, v) => [c + Math.cos(ang(i)) * R * (v / 100), c + Math.sin(ang(i)) * R * (v / 100)];
  let s = `<svg class="radar draw" viewBox="-50 0 ${size + 100} ${size}" role="img" aria-label="Radar of the five metrics">`;
  [25, 50, 75, 100].forEach((r) => (s += `<polygon points="${metrics.map((_, i) => pt(i, r).join(",")).join(" ")}" fill="none" stroke="var(--line)"/>`));
  metrics.forEach((m, i) => {
    const [x, y] = pt(i, 100), [lx, ly] = pt(i, mini ? 128 : 122);
    s += `<line x1="${c}" y1="${c}" x2="${x}" y2="${y}" stroke="var(--line)"/>`;
    s += `<text x="${lx}" y="${ly}" text-anchor="${Math.abs(lx - c) < 8 ? "middle" : lx > c ? "start" : "end"}" dominant-baseline="middle" class="radar-lbl">${esc(m.short)}</text>`;
  });
  const vals = metrics.map((m) => ({ d: showData ? m.data?.score ?? null : null, st: m.student }));
  const draw = (key, cls, lab) => {
    const pts = vals.map((m, i) => [m[key], i]).filter(([v]) => v != null).map(([v, i]) => [...pt(i, v), v, i]);
    if (pts.length >= 3) s += `<polygon class="${cls} grow" style="transform-origin:${c}px ${c}px" points="${pts.map((p) => p[0] + "," + p[1]).join(" ")}"/>`;
    pts.forEach(([x, y, v, i], k) => (s += `<circle class="${cls}-dot pop" style="--i:${k}" cx="${x}" cy="${y}" r="5" data-tip="<b>${esc(metrics[i].short)}</b><br>${lab}: ${Math.round(v)}/100"/>`));
  };
  draw("d", "r-data", "Public data");
  draw("st", "r-stu", "Student rating");
  return s + "</svg>";
}

/* ------------------------------------------------------------------ sparkline */
export function sparkline(series, { w = 120, h = 34 } = {}) {
  const pts = Object.entries(series || {}).filter(([, v]) => v != null).map(([y, v]) => [+y, v]);
  if (pts.length < 2) return `<svg class="spark" viewBox="0 0 ${w} ${h}"><line x1="2" y1="${h / 2}" x2="${w - 2}" y2="${h / 2}" stroke="var(--line)" stroke-dasharray="3 4"/></svg>`;
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), lo = Math.min(...ys), hi = Math.max(...ys);
  const X = (x) => 3 + ((x - x0) / (x1 - x0)) * (w - 6), Y = (v) => h - 4 - ((v - lo) / (hi - lo || 1)) * (h - 10);
  const d = pts.map(([x, v], i) => (i ? "L" : "M") + X(x).toFixed(1) + " " + Y(v).toFixed(1)).join(" ");
  const last = pts[pts.length - 1];
  return `<svg class="spark draw" viewBox="0 0 ${w} ${h}" aria-hidden="true"><path class="plc-line" pathLength="1" d="${d}" fill="none" stroke="var(--c1)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="${X(last[0])}" cy="${Y(last[1])}" r="3" fill="var(--c2)" class="pop"/></svg>`;
}

/* ------------------------------------------------------------------ salary explorer (hover any year) */
export function salaryExplorer(data, id, { w = 640, h = 300 } = {}) {
  const years = data.years, S = data.iims[id].series.salary;
  const abc = years.map((y) => { const v = ["ahmedabad", "bangalore", "calcutta"].map((k) => data.iims[k].series.salary[y]).filter((x) => x != null); return v.length >= 2 ? v.reduce((a, b) => a + b, 0) / v.length : null; });
  const own = years.map((y) => S[y] ?? null);
  const hi = Math.ceil(Math.max(...abc.filter(Boolean), ...own.filter(Boolean)) / 10) * 10;
  const L = 44, R = 18, T = 20, B = 36, iw = w - L - R, ih = h - T - B;
  const X = (i) => L + (i / (years.length - 1)) * iw, Y = (v) => T + (1 - v / hi) * ih;
  const path = (arr) => { let d = "", pen = false; arr.forEach((v, i) => { if (v == null) { pen = false; return; } d += (pen ? " L" : " M") + X(i).toFixed(1) + " " + Y(v).toFixed(1); pen = true; }); return d.trim(); };
  let s = `<svg class="explorer draw" viewBox="0 0 ${w} ${h}" role="img" aria-label="Median salary by year compared with IIM A/B/C">`;
  for (let v = 0; v <= hi; v += hi / 4) s += `<line x1="${L}" x2="${w - R}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--line)"/><text x="${L - 8}" y="${Y(v) + 4}" text-anchor="end" class="ax">${Math.round(v)}</text>`;
  years.forEach((y, i) => (s += `<text x="${X(i)}" y="${h - 10}" text-anchor="middle" class="ax">${y}</text>`));
  s += `<text x="10" y="12" class="ax">₹ lakh</text>`;
  s += `<path class="plc-line" pathLength="1" d="${path(abc)}" fill="none" stroke="var(--accent-2)" stroke-width="2.4" stroke-dasharray="1" stroke-linecap="round" opacity=".9" style="stroke-dasharray:.015 .02"/>`;
  s += `<path class="plc-line" pathLength="1" d="${path(own)}" fill="none" stroke="var(--accent)" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>`;
  years.forEach((y, i) => {
    const tip = `<b>${y}</b><br>${esc(data.iims[id].name)}: ${own[i] != null ? "₹" + own[i] + " L" : "n/a"}<br>IIM A/B/C avg: ${abc[i] != null ? "₹" + abc[i].toFixed(1) + " L" : "n/a"}${own[i] != null && abc[i] ? `<br>= ${Math.round((own[i] / abc[i]) * 100)}% of A/B/C` : ""}`;
    s += `<g class="col" data-tip="${tip.replace(/"/g, "&quot;")}"><rect x="${X(i) - iw / (years.length - 1) / 2}" y="${T}" width="${iw / (years.length - 1)}" height="${ih}" fill="transparent"/><line class="guide" x1="${X(i)}" x2="${X(i)}" y1="${T}" y2="${T + ih}"/>`;
    if (own[i] != null) s += `<circle class="ex-dot" cx="${X(i)}" cy="${Y(own[i])}" r="5" fill="var(--accent)" stroke="var(--bg)" stroke-width="2"/>`;
    if (abc[i] != null) s += `<circle class="ex-dot" cx="${X(i)}" cy="${Y(abc[i])}" r="4" fill="var(--accent-2)" stroke="var(--bg)" stroke-width="2"/>`;
    s += `</g>`;
  });
  return s + "</svg>";
}
