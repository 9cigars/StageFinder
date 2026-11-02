// Motion and interaction layer: themed particles that react to the cursor, cursor glow, 3D tilt,
// magnetic buttons, click ripples, scroll reveals, count-ups, tooltips and the theme-switch wipe.
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const fine = matchMedia("(hover: hover) and (pointer: fine)").matches;
const rnd = (a, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
const $ = (s) => document.querySelector(s);

function rgba(hex, a) {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.replace(/./g, "$&$&") : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/* ------------------------------------------------------------------ particles */
let cv, cx, W = 0, H = 0, dpr = 1, parts = [], kind = "network", col = { a: "#9fb0ff", b: "#f0c27b" };
const mouse = { x: -999, y: -999, vx: 0, vy: 0, down: 0 };

const KINDS = {
  snow: { n: 90, make: () => ({ x: rnd(W), y: rnd(H), r: rnd(1, 3.2), vy: rnd(0.25, 0.9), ph: rnd(6.28) }),
    step: (p, t) => { p.x += Math.sin(t / 1100 + p.ph) * 0.35; p.y += p.vy; },
    draw: (p) => { cx.fillStyle = "rgba(255,255,255,.75)"; cx.beginPath(); cx.arc(p.x, p.y, p.r, 0, 6.28); cx.fill(); } },
  petals: { n: 38, make: () => ({ x: rnd(W), y: rnd(H), r: rnd(4, 9), vy: rnd(0.35, 0.9), vx: rnd(0.1, 0.5), rot: rnd(6.28), vr: rnd(-0.03, 0.03), c: Math.random() < 0.7 ? 0 : 1 }),
    step: (p, t) => { p.x += p.vx + Math.sin(t / 900 + p.rot) * 0.4; p.y += p.vy; p.rot += p.vr; },
    draw: (p) => { cx.save(); cx.translate(p.x, p.y); cx.rotate(p.rot); cx.fillStyle = rgba(p.c ? col.b : col.a, 0.65); cx.beginPath(); cx.ellipse(0, 0, p.r, p.r * 0.5, 0, 0, 6.28); cx.fill(); cx.restore(); } },
  embers: { n: 64, make: () => ({ x: rnd(W), y: rnd(H), r: rnd(1, 2.6), vy: -rnd(0.3, 1.1), ph: rnd(6.28), c: Math.random() < 0.5 }),
    step: (p, t) => { p.x += Math.sin(t / 700 + p.ph) * 0.5; p.y += p.vy; },
    draw: (p, t) => { cx.fillStyle = rgba(p.c ? col.a : col.b, 0.35 + 0.45 * Math.abs(Math.sin(t / 500 + p.ph))); cx.beginPath(); cx.arc(p.x, p.y, p.r, 0, 6.28); cx.fill(); } },
  network: { n: 58, make: () => ({ x: rnd(W), y: rnd(H), r: rnd(1.2, 2.4), vx: rnd(-0.25, 0.25), vy: rnd(-0.25, 0.25) }),
    step: (p) => { p.x += p.vx; p.y += p.vy; if (p.x < 0 || p.x > W) p.vx *= -1; if (p.y < 0 || p.y > H) p.vy *= -1; },
    draw: (p, t, all) => {
      cx.fillStyle = rgba(col.a, 0.8); cx.beginPath(); cx.arc(p.x, p.y, p.r, 0, 6.28); cx.fill();
      for (const q of all) { if (q === p) continue; const d = Math.hypot(p.x - q.x, p.y - q.y); if (d < 130) { cx.strokeStyle = rgba(col.b, (1 - d / 130) * 0.28); cx.lineWidth = 1; cx.beginPath(); cx.moveTo(p.x, p.y); cx.lineTo(q.x, q.y); cx.stroke(); } }
      const dm = Math.hypot(p.x - mouse.x, p.y - mouse.y); if (dm < 170) { cx.strokeStyle = rgba(col.a, (1 - dm / 170) * 0.5); cx.beginPath(); cx.moveTo(p.x, p.y); cx.lineTo(mouse.x, mouse.y); cx.stroke(); } } },
  rain: { n: 80, make: () => ({ x: rnd(W), y: rnd(H), l: rnd(12, 24), vy: rnd(7, 12), vx: 2.4 }),
    step: (p) => { p.x += p.vx; p.y += p.vy; },
    draw: (p) => { cx.strokeStyle = rgba(col.b, 0.28); cx.lineWidth = 1.2; cx.beginPath(); cx.moveTo(p.x, p.y); cx.lineTo(p.x - 2.4, p.y - p.l); cx.stroke(); } },
  leaves: { n: 30, make: () => ({ x: rnd(W), y: rnd(H), r: rnd(5, 10), vy: rnd(0.4, 1), vx: rnd(0.2, 0.7), rot: rnd(6.28), vr: rnd(-0.04, 0.04), c: Math.random() < 0.6 }),
    step: (p, t) => { p.x += p.vx + Math.sin(t / 800 + p.rot) * 0.5; p.y += p.vy; p.rot += p.vr; },
    draw: (p) => { cx.save(); cx.translate(p.x, p.y); cx.rotate(p.rot); cx.fillStyle = rgba(p.c ? col.a : col.b, 0.55); cx.beginPath(); cx.moveTo(-p.r, 0); cx.quadraticCurveTo(0, -p.r * 0.8, p.r, 0); cx.quadraticCurveTo(0, p.r * 0.8, -p.r, 0); cx.fill(); cx.restore(); } },
  ripples: { n: 8, make: () => ({ x: rnd(W), y: rnd(H * 0.2, H), r: rnd(0, 60), max: rnd(90, 190), v: rnd(0.35, 0.8) }),
    step: (p) => { p.r += p.v; if (p.r > p.max) { p.r = 0; p.x = rnd(W); p.y = rnd(H * 0.2, H); } },
    draw: (p) => { cx.strokeStyle = rgba(col.a, 0.4 * (1 - p.r / p.max)); cx.lineWidth = 1.6; cx.beginPath(); cx.ellipse(p.x, p.y, p.r, p.r * 0.36, 0, 0, 6.28); cx.stroke(); } },
  mist: { n: 10, make: () => ({ x: rnd(W), y: rnd(H * 0.3, H), r: rnd(160, 320), vx: rnd(0.12, 0.4) }),
    step: (p) => { p.x += p.vx; if (p.x - p.r > W) p.x = -p.r; },
    draw: (p) => { const g = cx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r); g.addColorStop(0, rgba(col.b, 0.1)); g.addColorStop(1, rgba(col.b, 0)); cx.fillStyle = g; cx.beginPath(); cx.arc(p.x, p.y, p.r, 0, 6.28); cx.fill(); } },
  lanterns: { n: 30, make: () => ({ x: rnd(W), y: rnd(H), r: rnd(3, 6.5), vy: -rnd(0.25, 0.7), ph: rnd(6.28) }),
    step: (p, t) => { p.x += Math.sin(t / 1300 + p.ph) * 0.45; p.y += p.vy; },
    draw: (p, t) => { const g = cx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 4); const a = 0.55 + 0.25 * Math.sin(t / 400 + p.ph); g.addColorStop(0, rgba(col.a, a)); g.addColorStop(0.35, rgba(col.a, a * 0.35)); g.addColorStop(1, rgba(col.a, 0)); cx.fillStyle = g; cx.beginPath(); cx.arc(p.x, p.y, p.r * 4, 0, 6.28); cx.fill(); } },
};

function resize() {
  dpr = Math.min(devicePixelRatio || 1, 2);
  W = innerWidth; H = innerHeight;
  cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + "px"; cv.style.height = H + "px";
  cx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
function rebuild() { const k = KINDS[kind] || KINDS.network; parts = Array.from({ length: Math.round(k.n * (W < 700 ? 0.55 : 1)) }, k.make); }
function loop(t) {
  requestAnimationFrame(loop);
  if (document.hidden || !cx) return;
  cx.clearRect(0, 0, W, H);
  const k = KINDS[kind] || KINDS.network;
  for (const p of parts) {
    // cursor pushes particles away (network connects to the cursor instead)
    if (kind !== "network" && kind !== "mist" && kind !== "ripples") {
      const dx = p.x - mouse.x, dy = p.y - mouse.y, d = Math.hypot(dx, dy);
      if (d < 120 && d > 0) { const f = (1 - d / 120) * (mouse.down ? 9 : 2.2); p.x += (dx / d) * f; p.y += (dy / d) * f; }
    }
    k.step(p, t);
    if (p.y > H + 20) { p.y = -20; p.x = rnd(W); }
    if (p.y < -30 && p.vy < 0) { p.y = H + 20; p.x = rnd(W); }
    if (p.x > W + 30) p.x = -20;
    if (p.x < -30) p.x = W + 20;
    k.draw(p, t, parts);
  }
}

export function setParticles(theme) {
  kind = theme.fx || "network"; col = { a: theme.accent, b: theme.accent2 };
  if (cx) rebuild();
}

/* ------------------------------------------------------------------ init */
export function initFx() {
  cv = $("#fx"); cx = cv.getContext("2d");
  resize(); rebuild();
  addEventListener("resize", () => { resize(); rebuild(); });
  if (!reduce) requestAnimationFrame(loop);

  const glow = $("#cursor"), ring = $("#ring");
  let gx = innerWidth / 2, gy = innerHeight / 2, rx = gx, ry = gy;
  addEventListener("pointermove", (e) => {
    mouse.x = e.clientX; mouse.y = e.clientY;
    const r = document.documentElement.style;
    r.setProperty("--px", ((e.clientX / innerWidth) * 2 - 1).toFixed(3));
    r.setProperty("--py", ((e.clientY / innerHeight) * 2 - 1).toFixed(3));
    if (ring) ring.classList.toggle("hot", !!e.target.closest?.("button, a, select, [data-action], .tilt, input, textarea"));
  }, { passive: true });
  addEventListener("pointerdown", () => { mouse.down = 1; setTimeout(() => (mouse.down = 0), 180); });
  if (fine && !reduce && glow) {
    document.body.classList.add("has-cursor");
    (function follow() {
      gx += (mouse.x - gx) * 0.12; gy += (mouse.y - gy) * 0.12; rx += (mouse.x - rx) * 0.32; ry += (mouse.y - ry) * 0.32;
      glow.style.transform = `translate3d(${gx - 260}px,${gy - 260}px,0)`;
      ring.style.transform = `translate3d(${rx - 16}px,${ry - 16}px,0)`;
      requestAnimationFrame(follow);
    })();
  }

  // 3D tilt + spotlight, magnetic pull
  document.addEventListener("pointermove", (e) => {
    const t = e.target.closest?.(".tilt");
    if (t && fine) {
      const r = t.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      t.style.setProperty("--rx", ((0.5 - y) * 9).toFixed(2) + "deg"); t.style.setProperty("--ry", ((x - 0.5) * 11).toFixed(2) + "deg");
      t.style.setProperty("--sx", (x * 100).toFixed(1) + "%"); t.style.setProperty("--sy", (y * 100).toFixed(1) + "%");
    }
    const m = e.target.closest?.(".mag");
    if (m && fine) { const r = m.getBoundingClientRect(); m.style.transform = `translate(${((e.clientX - r.left - r.width / 2) * 0.22).toFixed(1)}px,${((e.clientY - r.top - r.height / 2) * 0.32).toFixed(1)}px)`; }
  }, { passive: true });
  document.addEventListener("pointerout", (e) => {
    const t = e.target.closest?.(".tilt"); if (t && !t.contains(e.relatedTarget)) { t.style.setProperty("--rx", "0deg"); t.style.setProperty("--ry", "0deg"); }
    const m = e.target.closest?.(".mag"); if (m && !m.contains(e.relatedTarget)) m.style.transform = "";
  });

  // click ripple
  document.addEventListener("pointerdown", (e) => {
    const el = e.target.closest?.(".btn, .opt, .chip, .iim-card, .lv, .stagechoice");
    if (!el || reduce) return;
    const r = el.getBoundingClientRect(), s = document.createElement("span");
    const d = Math.max(r.width, r.height) * 2;
    s.className = "rp"; s.style.cssText = `width:${d}px;height:${d}px;left:${e.clientX - r.left - d / 2}px;top:${e.clientY - r.top - d / 2}px`;
    el.appendChild(s); setTimeout(() => s.remove(), 700);
  });

  // tooltips
  const tip = $("#tip");
  document.addEventListener("pointerover", (e) => { const t = e.target.closest?.("[data-tip]"); if (t) { tip.innerHTML = t.dataset.tip; tip.classList.add("on"); } });
  document.addEventListener("pointermove", (e) => { if (tip.classList.contains("on")) { const w = tip.offsetWidth; tip.style.transform = `translate(${Math.min(e.clientX + 16, innerWidth - w - 10)}px,${e.clientY + 18}px)`; } }, { passive: true });
  document.addEventListener("pointerout", (e) => { if (e.target.closest?.("[data-tip]")) tip.classList.remove("on"); });
}

/* ------------------------------------------------------------------ reveals + count-up */
let io;
const ease = (x) => 1 - Math.pow(1 - x, 3);
function countUp(el) {
  const to = +el.dataset.count, dec = +(el.dataset.dec || 0), pre = el.dataset.pre || "", suf = el.dataset.suf || "";
  if (reduce) { el.textContent = pre + to.toFixed(dec) + suf; return; }
  const t0 = performance.now(), dur = 1300;
  (function f(now) {
    const k = Math.min(1, (now - t0) / dur);
    el.textContent = pre + (to * ease(k)).toFixed(dec) + suf;
    if (k < 1) requestAnimationFrame(f);
  })(t0);
}
export function observe(root = document) {
  io ||= new IntersectionObserver((es) => es.forEach((e) => {
    if (!e.isIntersecting) return;
    e.target.classList.add("in");
    e.target.querySelectorAll?.("[data-count]").forEach(countUp);
    if (e.target.dataset.count) countUp(e.target);
    io.unobserve(e.target);
  }), { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });
  root.querySelectorAll(".rv:not(.in), .draw:not(.in)").forEach((el, i) => { if (!el.style.transitionDelay && el.dataset.d) el.style.transitionDelay = el.dataset.d + "ms"; io.observe(el); });
}

/* ------------------------------------------------------------------ theme wipe */
export function wipe(x, y, theme, apply) {
  const o = $("#wipe");
  if (reduce || !o) return apply();
  o.style.setProperty("--x", x + "px"); o.style.setProperty("--y", y + "px");
  o.style.background = `radial-gradient(circle at ${x}px ${y}px, ${theme.accent}, ${theme.bg} 55%)`;
  o.classList.remove("go"); void o.offsetWidth; o.classList.add("go");
  setTimeout(apply, 330);
}
