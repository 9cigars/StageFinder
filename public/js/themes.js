// One palette, one moving scene and one particle effect per IIM. The whole page re-themes when an IIM is chosen.
// These are original colour schemes inspired by each place; they are not official branding.
import { setParticles, wipe } from "./fx.js";

export const NEUTRAL = {
  name: "Neutral", accent: "#9fb0ff", accent2: "#f0c27b", bg: "#0b0d14", surface: "#141826", ink: "#eef0f7",
  motif: "grid", fx: "network", line: "Pick your institute", seed: 3,
};

export const THEMES = {
  ahmedabad: { accent: "#ef7a3d", accent2: "#f5c98a", bg: "#160c08", surface: "#24140d", ink: "#fbefe6", motif: "jali", fx: "embers", seed: 1, line: "Stepwells and sandstone jali" },
  bangalore: { accent: "#5b93ff", accent2: "#6fe3c6", bg: "#080e1d", surface: "#101a31", ink: "#eaf1ff", motif: "grid", fx: "network", seed: 2, line: "A garden city that became a grid" },
  calcutta: { accent: "#e5484d", accent2: "#f3d9a4", bg: "#180a0c", surface: "#27121a", ink: "#fdeeee", motif: "arches", fx: "rain", seed: 3, line: "Colonnades, trams and monsoon rain" },
  jammu: { accent: "#4cc0f0", accent2: "#ffa04d", bg: "#06141c", surface: "#0d2230", ink: "#e9f7fd", motif: "ridge", fx: "snow", seed: 4, snow: true, line: "Snow peaks above the Tawi" },
  ranchi: { accent: "#59c978", accent2: "#e8c95b", bg: "#07140c", surface: "#0f2316", ink: "#ebf8ef", motif: "plateau", fx: "leaves", seed: 5, line: "Plateau, forest and waterfalls" },
  sambalpur: { accent: "#9a85ff", accent2: "#4fd1c5", bg: "#0e0a20", surface: "#1a1436", ink: "#f0edff", motif: "waves", fx: "ripples", seed: 6, line: "The long reach of the Hirakud reservoir" },
  shillong: { accent: "#2ed8b0", accent2: "#b8ef72", bg: "#06161a", surface: "#0d262b", ink: "#e8fbf6", motif: "ridge", fx: "mist", seed: 7, mist: true, line: "Rolling hills under mist" },
  sirmaur: { accent: "#ee5f8e", accent2: "#8fd1a8", bg: "#150a11", surface: "#241320", ink: "#fdeef4", motif: "ridge", fx: "petals", seed: 8, line: "Rhododendron and pine in the Shivalik foothills" },
};

export const themeFor = (id) => ({ ...NEUTRAL, ...(THEMES[id] || {}) });

function rng(seed) {
  let s = seed * 9301 + 49297;
  return () => ((s = (s * 9301 + 49297) % 233280) / 233280);
}
function ridgePath(r, w, base, amp, step) {
  let x = -60, y = base - amp * (0.4 + r() * 0.6), d = `M-60 ${base} L-60 ${y.toFixed(1)}`;
  while (x < w + 60) { x += step * (0.5 + r()); y = base - amp * (0.15 + r() * 0.85); d += ` L${x.toFixed(1)} ${y.toFixed(1)}`; }
  return d + ` L${w + 60} ${base} Z`;
}
const anim = (cls, dur, delay = 0) => `class="${cls}" style="animation-duration:${dur}s;animation-delay:${-delay}s"`;

const motifs = {
  ridge(t) {
    const r = rng(t.seed), W = 1200, H = 360;
    const layers = [{ a: 150, o: 0.16, s: 120, y: 250, d: 26 }, { a: 120, o: 0.26, s: 90, y: 290, d: 20 }, { a: 90, o: 0.42, s: 70, y: 330, d: 15 }, { a: 55, o: 0.7, s: 55, y: 362, d: 11 }];
    let svg = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMax slice" xmlns="http://www.w3.org/2000/svg">`;
    if (t.snow) svg += `<circle cx="930" cy="90" r="34" fill="var(--accent-2)" opacity=".85" ${anim("m-pulse", 5)}/>`;
    else svg += `<circle cx="880" cy="110" r="26" fill="var(--accent-2)" opacity=".5" ${anim("m-pulse", 6)}/>`;
    layers.forEach((l, i) => (svg += `<path d="${ridgePath(r, W, l.y, l.a, l.s)}" fill="${i % 2 ? "var(--accent)" : "var(--accent-2)"}" opacity="${l.o}" ${anim("m-drift", l.d, i * 3)}/>`));
    if (t.mist) svg += `<g ${anim("m-wave", 30)}><rect x="-300" y="236" width="1800" height="70" fill="url(#mist)"/></g><defs><linearGradient id="mist" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--ink)" stop-opacity="0"/><stop offset=".5" stop-color="var(--ink)" stop-opacity=".2"/><stop offset="1" stop-color="var(--ink)" stop-opacity="0"/></linearGradient></defs>`;
    return svg + "</svg>";
  },
  plateau(t) {
    const r = rng(t.seed), W = 1200;
    let svg = `<svg viewBox="0 0 ${W} 360" preserveAspectRatio="xMidYMax slice" xmlns="http://www.w3.org/2000/svg">`;
    svg += `<path ${anim("m-drift", 24)} d="M-40 230 L220 230 L260 262 L520 262 L560 215 L840 215 L880 250 L1240 250 L1240 360 L-40 360Z" fill="var(--accent)" opacity=".2"/>`;
    svg += `<path ${anim("m-drift", 17, 4)} d="M-40 300 L300 300 L340 285 L700 285 L740 310 L1240 310 L1240 360 L-40 360Z" fill="var(--accent2)" opacity=".28"/>`;
    for (let i = 0; i < 8; i++) { const x = 380 + i * 52 + r() * 18; svg += `<path d="M${x} 215 L${x + 6} 262" stroke="var(--ink)" stroke-width="2" stroke-linecap="round" stroke-dasharray="14 36" ${anim("m-fall", 1.6 + r(), r() * 2)}/>`; }
    return svg + "</svg>";
  },
  jali() {
    return `<svg viewBox="0 0 1200 360" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg"><defs>
      <pattern id="jl" width="60" height="60" patternUnits="userSpaceOnUse"><path d="M30 4 L56 30 L30 56 L4 30Z" fill="none" stroke="var(--accent)" stroke-width="1.4"/><circle cx="30" cy="30" r="9" fill="none" stroke="var(--accent-2)" stroke-width="1.2"/><circle cx="30" cy="30" r="2.5" fill="var(--accent-2)"/></pattern>
      <linearGradient id="jf" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--bg)" stop-opacity="0"/><stop offset="1" stop-color="var(--bg)"/></linearGradient></defs>
      <g class="m-pan"><rect x="-60" y="-60" width="1320" height="480" fill="url(#jl)" opacity=".6"/></g><rect width="1200" height="360" fill="url(#jf)"/></svg>`;
  },
  grid(t) {
    const r = rng(t.seed);
    let svg = `<svg viewBox="0 0 1200 360" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg"><defs>
      <pattern id="gd" width="40" height="40" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.6" fill="var(--accent)" opacity=".5"/></pattern>
      <linearGradient id="gf" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--bg)" stop-opacity="0"/><stop offset="1" stop-color="var(--bg)"/></linearGradient></defs>
      <g class="m-pan"><rect x="-40" y="-40" width="1280" height="440" fill="url(#gd)"/></g>`;
    let px = 80, py = 200, d = `M${px} ${py}`; const nodes = [];
    for (let i = 0; i < 9; i++) { const prevY = py; px += 100 + r() * 60; py = 80 + Math.round(r() * 5) * 40; d += ` L${px - 40} ${prevY} L${px} ${py}`; nodes.push([px, py]); }
    svg += `<path d="${d}" fill="none" stroke="var(--accent-2)" stroke-width="2" opacity=".65" stroke-dasharray="10 12" class="m-dash"/>`;
    nodes.forEach(([x, y], i) => (svg += `<circle cx="${x}" cy="${y}" r="5" fill="var(--accent-2)" ${anim("m-pulse", 2.4, i * 0.3)}/>`));
    return svg + `<rect width="1200" height="360" fill="url(#gf)"/></svg>`;
  },
  arches() {
    let svg = `<svg viewBox="0 0 1200 360" preserveAspectRatio="xMidYMax slice" xmlns="http://www.w3.org/2000/svg">`;
    for (let row = 0; row < 3; row++) {
      const w = 90 - row * 14, y = 360 - row * 56; let i = 0;
      for (let x = -40 + row * 30; x < 1240; x += w + 12, i++) svg += `<path d="M${x} ${y} V${y - 70 + row * 12} a${w / 2} ${w / 2} 0 0 1 ${w} 0 V${y}Z" fill="${row % 2 ? "var(--accent-2)" : "var(--accent)"}" opacity="${0.16 + row * 0.1}" ${anim("m-shim", 4 + (i % 4), i * 0.6)}/>`;
    }
    return svg + "</svg>";
  },
  waves() {
    let svg = `<svg viewBox="0 0 1200 360" preserveAspectRatio="xMidYMax slice" xmlns="http://www.w3.org/2000/svg">`;
    for (let i = 0; i < 5; i++) {
      const y = 190 + i * 36, a = 16 + i * 3; let d = `M-200 ${y}`;
      for (let x = -200; x <= 1400; x += 100) d += ` Q${x + 50} ${y - a} ${x + 100} ${y}`;
      svg += `<path d="${d} V360 H-200Z" fill="${i % 2 ? "var(--accent-2)" : "var(--accent)"}" opacity="${0.12 + i * 0.07}" ${anim("m-wave", 9 + i * 3, i)}/>`;
    }
    return svg + "</svg>";
  },
  gopuram() {
    let svg = `<svg viewBox="0 0 1200 360" preserveAspectRatio="xMidYMax slice" xmlns="http://www.w3.org/2000/svg">`;
    const tower = (cx, tiers, o, d) => {
      let s = `<g ${anim("m-glow", d)}>`;
      for (let i = 0; i < tiers; i++) { const w = 220 - i * (200 / tiers), y = 360 - i * 30 - 30; s += `<rect x="${cx - w / 2}" y="${y}" width="${w}" height="30" fill="${i % 2 ? "var(--accent-2)" : "var(--accent)"}" opacity="${o}"/>`; }
      return s + `<path d="M${cx - 16} ${360 - tiers * 30 - 30} Q${cx} ${360 - tiers * 30 - 70} ${cx + 16} ${360 - tiers * 30 - 30}Z" fill="var(--accent)" opacity="${o + 0.1}"/></g>`;
    };
    return svg + tower(300, 8, 0.12, 5) + tower(780, 10, 0.16, 6) + tower(1060, 6, 0.1, 4.5) + "</svg>";
  },
};

export const motifSvg = (id) => {
  const t = themeFor(id);
  return (motifs[t.motif] || motifs.grid)(t);
};

function paint(id) {
  const t = themeFor(id), root = document.documentElement;
  root.style.setProperty("--accent", t.accent); root.style.setProperty("--accent-2", t.accent2);
  root.style.setProperty("--bg", t.bg); root.style.setProperty("--surface", t.surface); root.style.setProperty("--ink", t.ink);
  root.dataset.iim = id || "none";
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", t.bg);
  setParticles(t);
  const m = document.getElementById("motif");
  if (m) {
    const next = document.createElement("div");
    next.className = "motif-layer"; next.innerHTML = motifSvg(id);
    m.appendChild(next);
    requestAnimationFrame(() => next.classList.add("on"));
    [...m.children].slice(0, -1).forEach((old) => { old.classList.remove("on"); setTimeout(() => old.remove(), 900); });
  }
  return t;
}

// applyTheme(id) switches instantly; applyTheme(id, {x, y}) plays the colour wipe from that point first.
export function applyTheme(id, from) {
  const t = themeFor(id);
  if (from && document.documentElement.dataset.iim !== (id || "none")) wipe(from.x, from.y, t, () => paint(id));
  else paint(id);
  return t;
}
