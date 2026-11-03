// Guided demo: fills in the real quiz for IIM Sirmaur by clicking the real buttons, one step per key press.
// Keys: → / Space next step · A auto-play · N show the spoken line · Esc stop
// Nothing is sent to a server: the app skips submission while this runs.
import { QUESTIONS, PROGRAMMES } from "./questions.js";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const Q = (id) => QUESTIONS.find((q) => q.id === id);

export function startGuided({ prepare, onStop }) {
  prepare();

  const cursor = document.createElement("div");
  cursor.id = "gcursor"; cursor.innerHTML = "<i></i>";
  const bar = document.createElement("div");
  bar.id = "gbar"; bar.innerHTML = `<div class="g-say" id="gsay" hidden></div><div class="g-pill"><span id="gcount"></span><span class="g-hint">→ next · A auto · N script · Esc stop</span></div>`;
  document.body.append(cursor, bar);
  cursor.style.transform = `translate(${innerWidth * 0.6}px, ${innerHeight * 0.55}px)`;

  const waitFor = async (fn, ms = 5000) => { const t = Date.now(); for (;;) { const v = fn(); if (v) return v; if (Date.now() - t > ms) return null; await sleep(60); } };
  const onQ = (id) => waitFor(() => document.querySelector(".qprompt")?.textContent.trim() === Q(id).prompt);

  async function moveTo(el) {
    const r = el.getBoundingClientRect();
    cursor.style.transform = `translate(${r.left + Math.min(r.width / 2, 120)}px, ${r.top + r.height / 2}px)`;
    await sleep(650);
  }
  async function click(sel) {
    const el = await waitFor(() => document.querySelector(sel));
    if (!el) return null;
    el.scrollIntoView({ block: "center", behavior: "instant" });
    await moveTo(el);
    cursor.classList.add("press"); await sleep(140); el.click(); await sleep(120); cursor.classList.remove("press");
    await sleep(250);
    return el;
  }
  async function choose(sel, value, evt) {
    const el = await waitFor(() => document.querySelector(sel));
    if (!el) return;
    el.scrollIntoView({ block: "center", behavior: "instant" });
    await moveTo(el);
    el.value = value; el.dispatchEvent(new Event(evt, { bubbles: true }));
    await sleep(500);
  }
  async function scrollTo(sel, wait = 1600) {
    const el = await waitFor(() => document.querySelector(sel));
    if (!el) return;
    const top = el.getBoundingClientRect().top + scrollY - 90;
    scroll({ top, behavior: "smooth" });
    await sleep(wait);
    if (Math.abs(scrollY - top) > 40) scroll({ top, behavior: "instant" });   // smooth scrolling can be throttled or disabled
  }
  const rate = async (id, level, extra = async () => {}) => { await onQ(id); await click(`.lv[data-v="${level}"]`); await extra(); await click('[data-action="next"]:not([disabled])'); };
  const stage = async (id, v) => { await onQ(id); await click(`.stagechoice[data-v="${v}"]`); };

  const STEPS = [
    { gap: 1500, say: "A student picks the institute and starts the ten questions. The whole site already speaks in Sirmaur's colours.", run: async () => { await click('[data-action="start"]'); } },
    { gap: 1200, say: "Reputation: people say \"is that the new IIM, sounds promising\". Known, and rising.", run: () => stage("a1", "growth") },
    { gap: 1200, say: "Recruiters: more new companies show up every year.", run: () => stage("a2", "growth") },
    { gap: 1200, say: "Processes: visibly better every term.", run: () => stage("a3", "growth") },
    { gap: 1200, say: "Faculty: new faculty keep joining and more courses are added.", run: () => stage("a4", "growth") },
    { gap: 1800, say: "Salary direction: rising clearly each year. All five answers vote for Growth, and the live curve on the right has found its place.", run: () => stage("a5", "growth") },
    { gap: 2800, say: "Part B, salary. Below the top IIMs. The causes I name: recruiters are reluctant because of the location, and a sector is missing: consulting.", run: () => rate("b1", 2, async () => {
      await click('[data-c="s5"]'); await click('[data-c="s1"]'); await choose('select[data-detail="s1"]', "Consulting", "change"); }) },
    { gap: 2800, say: "Return on investment. Doubtful. The cause: the fee is high compared with the pay on offer.", run: () => rate("b2", 2, async () => { await click('[data-c="r1"]'); }) },
    { gap: 1800, say: "Faculty: most courses are taught by permanent PhD faculty.", run: () => rate("b3", 4) },
    { gap: 1800, say: "Research: visible sometimes.", run: () => rate("b4", 3) },
    { gap: 1800, say: "Diversity: slightly diverse. That is all ten questions.", run: () => rate("b5", 2) },
    { gap: 4200, say: "The last screen is optional and anonymous. Reveal the result.", run: async () => {
      await choose("#prog", PROGRAMMES[0], "input"); await click('[data-action="finish"]'); await waitFor(() => document.querySelector(".stage-title")); await sleep(3700); } },
    { gap: 3500, say: "Growth, and the students agree with the data. Sirmaur is on the early part of the growth slope.", run: () => scrollTo(".stage-title") },
    { gap: 3500, say: "Faculty is the strength. Salary and return on investment are the weaknesses.", run: () => scrollTo(".sw") },
    { gap: 4500, say: "These are the two bottlenecks. The tool checks each cause against the data: location is not backed, recruiters are 250 against 187. Fee versus pay is backed.", run: () => scrollTo(".bn") },
    { gap: 3500, say: "Below that, the problems ranked from Sirmaur's own numbers: pay first, then fee payback.", run: () => scrollTo(".probs") },
    { gap: 3500, say: "And for each problem, a playbook from schools that faced the same problem at a similar age.", run: () => scrollTo(".playbook") },
  ];

  let i = -1, busy = false, auto = false, timer = null, stopped = false;
  const count = () => { document.getElementById("gcount").textContent = i < 0 ? `Guided demo · ${STEPS.length} steps` : `Step ${i + 1} / ${STEPS.length}`; };
  count();
  const say = document.getElementById("gsay");

  async function next() {
    if (busy || stopped || i >= STEPS.length - 1) { if (i >= STEPS.length - 1) { auto = false; clearTimeout(timer); } return; }
    busy = true; i++; count(); say.textContent = STEPS[i].say;
    try { await STEPS[i].run(); } catch (e) { console.error(e); }
    busy = false;
    if (auto && !stopped) timer = setTimeout(next, STEPS[i].gap);
  }
  function toggleAuto() {
    auto = !auto; clearTimeout(timer); bar.classList.toggle("auto", auto);
    if (auto && !busy) timer = setTimeout(next, 400);
  }
  function stop() {
    stopped = true; clearTimeout(timer); document.removeEventListener("keydown", key, true);
    cursor.remove(); bar.remove(); onStop?.();
  }
  function key(e) {
    if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    const k = e.key; let handled = true;
    if (k === "ArrowRight" || k === " " || k === "PageDown") next();
    else if (k === "a" || k === "A") toggleAuto();
    else if (k === "n" || k === "N") say.hidden = !say.hidden;
    else if (k === "Escape") stop();
    else if (/^[1-5]$/.test(k) || k === "Enter" || k === "ArrowLeft") { /* the demo drives the quiz; ignore stray keys */ }
    else handled = false;
    if (handled) { e.preventDefault(); e.stopPropagation(); }
  }
  document.addEventListener("keydown", key, true);
}
