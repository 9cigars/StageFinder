import { METRICS, QUESTIONS, CAUSES, CAUSE_BY_ID, PROGRAMMES, YEARS_OF_STUDY, STAGE_NAME, STAGE_ORDER, STAGE_QUESTIONS } from "./questions.js";
import { analyse, stageBoard, votesFrom, votePosition, aggregateToAnswers, latest, fmt, THRESHOLDS, BLEND } from "./engine.js";
import { applyTheme, themeFor } from "./themes.js";
import { initFx, observe } from "./fx.js";
import { plcChart, plcXY, radarChart, sparkline, salaryExplorer } from "./charts.js";
import { casesFor, causeCheck } from "./solutions.js";
import { diagnose } from "./diagnose.js";
import * as api from "./api.js";

const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const KEY = "iimstage.v2";
const empty = () => ({ stage: {}, ratings: {}, causes: {}, details: {} });
const ORDER = ["sirmaur", "ahmedabad", "bangalore", "calcutta", "jammu", "ranchi", "sambalpur", "shillong"];

let data, sol, pb, apiOk = false;
const saved = (() => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } })();
const state = { step: "home", iim: saved.iim || null, qi: 0, agg: null, fresh: false, answers: { ...empty(), ...(saved.answers || {}) }, meta: saved.meta || {}, anonId: saved.anonId || null };
const persist = () => { try { localStorage.setItem(KEY, JSON.stringify({ iim: state.iim, answers: state.answers, meta: state.meta, anonId: state.anonId })); } catch {} };
const toast = (msg) => { const t = $("#toast"); t.textContent = msg; t.classList.add("on"); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove("on"), 2200); };
const nick = (id) => data.iims[id].name.replace("IIM ", "");
const words = (s, start = 0) => s.split(" ").map((w, i) => `<span class="w" style="--i:${i + start}">${esc(w)}</span>`).join(" ");

const ICON = {
  intro: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21v-8"/><path d="M12 13c-4 0-6-2.5-6-6 4 0 6 2.5 6 6z"/><path d="M12 15c3 0 5-2 5-5-3 0-5 2-5 5z"/></svg>`,
  growth: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/></svg>`,
  mature: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 20h18"/><path d="M5 20l5-10 3 5 2-3 4 8"/></svg>`,
  decline: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7l6 6 4-4 8 8"/><path d="M15 17h6v-6"/></svg>`,
};

/* ------------------------------------------------------------------ boot + routing */
async function boot() {
  initFx();
  try { [data, sol, pb] = await Promise.all([fetch("data/iims.json").then((r) => r.json()), fetch("data/solutions.json").then((r) => r.json()), fetch("data/playbooks.json").then((r) => r.json())]); data.playbooksMeta = pb.problems; }
  catch { $("#app").innerHTML = `<section class="hero"><h1>Data failed to load</h1><p class="lead">Open this site through a web server (<code>node server.js</code>) so it can read <code>data/iims.json</code>.</p></section>`; return; }
  const q = new URLSearchParams(location.search).get("iim");
  if (q && data.iims[q]) { if (state.iim !== q) state.answers = empty(); state.iim = q; }
  if (state.iim && !data.iims[state.iim]) state.iim = null;
  applyTheme(state.iim);
  render();
  if (new URLSearchParams(location.search).get("demo")) openDemo();
  apiOk = await api.health();
}
async function openDemo() {
  const m = await import("./demo.js");
  m.startDemo({ data, pb, nick, onExit() { applyTheme(state.iim); }, onLive() { if (state.step !== "home") go("home"); pick("sirmaur", innerWidth / 2, innerHeight / 2); } });
}
function go(step, extra = {}) {
  Object.assign(state, { step }, extra);
  render();
  scrollTo({ top: 0, behavior: "instant" });
}
function render() {
  $("#topnav").innerHTML = state.iim
    ? `<span class="sel-pill"><b></b><span>${esc(data.iims[state.iim].name)}</span></span>` + (state.step !== "home" ? `<button class="btn ghost small" data-action="home">Change IIM</button>` : "")
    : "";
  const view = { home: viewHome, quiz: viewQuiz, about: viewAbout, results: viewResults }[state.step];
  $("#app").innerHTML = view();
  if (state.step === "quiz") updateLive(false);
  if (state.step === "results") { afterResults(); if (state.fresh) { showReveal(); state.fresh = false; setTimeout(() => observe($("#app")), 2900); return; } }
  observe($("#app"));
}
// choosing an IIM: wipe the screen in the new colours from the click point, swap content underneath
function pick(id, x, y) {
  if (id === state.iim) return $("#focus")?.scrollIntoView({ behavior: "smooth", block: "center" });
  state.answers = empty(); state.meta = {}; state.iim = id; persist();
  applyTheme(id, { x, y });
  setTimeout(() => { render(); $("#focus")?.scrollIntoView({ behavior: "smooth", block: "center" }); }, 380);
}

/* ------------------------------------------------------------------ home */
function iimCard(id, board) {
  const t = themeFor(id), i = data.iims[id], b = board.find((x) => x.id === id);
  return `<button class="iim-card tilt rv ${state.iim === id ? "sel" : ""}" data-d="${ORDER.indexOf(id) * 60}" style="--c1:${t.accent};--c2:${t.accent2}" data-action="pick" data-id="${id}" aria-pressed="${state.iim === id}">
    <span class="ini">${esc(nick(id).slice(0, 3).toUpperCase())}</span>
    <h3>${esc(i.name)}</h3><small>${esc(i.city)} · est. ${i.founded}</small>
    ${b ? `<span class="badge stage-${b.stage}">${b.stage}</span>` : ""}
    ${sparkline(i.series.salary)}</button>`;
}
function boardMarkers(board) {
  return board.map((b) => ({
    id: b.id, label: nick(b.id), t: b.t, primary: b.id === state.iim,
    tip: `<b>${esc(data.iims[b.id].name)}</b><br>${b.stage} · ${b.momentum}<br>Salary ${Math.round(b.level * 100)}% of IIM A/B/C`,
  }));
}
function viewHome() {
  const board = stageBoard(data);
  return `
  <section class="hero">
    <span class="eyebrow rv in">Operations management · product life cycle</span>
    <h1>${words("Where does your IIM stand in")} <em>${words("its life cycle?", 5)}</em></h1>
    <p class="lead rv" data-d="500">Ten short questions, set against public NIRF and placement data. You will see the stage your institute is in, what it does well, and the specific bottlenecks holding it back.</p>
    <div class="row rv" data-d="560" style="margin:6px 0 4px"><button class="btn" data-action="demo">▶ Presentation mode</button></div>
    <div class="board card rv" data-d="650">
      <div class="board-h"><div><span class="eyebrow" style="margin:0">Live stage board</span></div>
        <div class="legend2"><span>Hover a dot for the numbers</span><span>Click a name to open it</span></div></div>
      <div id="board">${plcChart(boardMarkers(board))}</div>
    </div>
  </section>
  <section id="pick"><span class="eyebrow rv">Step 1 · choose your institute</span>
    <div class="iim-grid">${ORDER.map((id) => iimCard(id, board)).join("")}</div>
    <div id="focus" style="margin-top:22px">${dossier(board)}</div>
  </section>
  <section><span class="eyebrow rv">How it works</span>
    <div class="steps">
      <div class="card tilt rv"><div class="n">A</div><h3>Read the stage</h3><p class="muted small">Five questions about things you can see: reputation, recruiters, processes, faculty and the direction of salaries. Each answer points to a life-cycle stage.</p></div>
      <div class="card tilt rv" data-d="120"><div class="n">B</div><h3>Find the bottleneck</h3><p class="muted small">One question per metric. Rate it, then name the specific cause: which department, which sector, which cost.</p></div>
      <div class="card tilt rv" data-d="240"><div class="n">C</div><h3>Compare with the data</h3><p class="muted small">Your answers meet NIRF and placement figures for 2021–2026. Agreements and gaps are both shown.</p></div>
    </div>
  </section>`;
}
function dossier(board) {
  if (!state.iim) return `<div class="card rv" style="text-align:center;padding:40px"><span class="serif" style="font-size:1.6rem">Pick an institute above and the whole page will change colour.</span></div>`;
  const i = data.iims[state.iim], t = themeFor(state.iim), b = board.find((x) => x.id === state.iim), S = i.series;
  const sal = latest(S.salary), ph = latest(S.phd), fi = latest(S.firms);
  const resumed = Object.keys(state.answers.stage).length + Object.keys(state.answers.ratings).length;
  const f = (label, v) => `<div class="fact"><b ${v.count != null ? `data-count="${v.count}" data-dec="${v.dec || 0}" data-pre="${v.pre || ""}" data-suf="${v.suf || ""}"` : ""}>${v.count != null ? "0" : "n/a"}</b><span>${label}</span></div>`;
  return `<div class="card dossier rv">
    <div><span class="eyebrow">${esc(t.line)}</span><h2>${esc(i.name)}</h2>
      <p class="meta">${esc(i.city)}, ${esc(i.state)} · founded ${i.founded}${b ? ` · <span class="badge stage-${b.stage}" style="margin:0">${b.stage} · ${b.momentum}</span>` : ""}</p>
      <div class="facts">
        ${f("median salary" + (sal ? ` (${sal.year})` : ""), sal ? { count: sal.value, dec: 1, pre: "₹", suf: " L" } : {})}
        ${f("faculty with PhDs", ph ? { count: ph.value * 100, suf: "%" } : {})}
        ${f("recruiters" + (fi ? ` (${fi.year})` : ""), fi ? { count: fi.value } : {})}
      </div>
      <div class="row"><button class="btn primary mag" data-action="start">${resumed ? "Resume the questions" : "Start the 10 questions"} →</button>
        <button class="btn" data-action="preview">Data-only result</button><button class="btn ghost small" data-action="share">Copy link for students</button></div></div>
    <div><span class="eyebrow">Median salary, 2021–2026 · hover a year</span>${salaryExplorer(data, state.iim)}
      <div class="chart-cap"><span><i style="background:var(--accent)"></i>${esc(i.name)}</span><span><i style="background:var(--accent-2)"></i>IIM A/B/C average</span></div></div>
  </div>`;
}

/* ------------------------------------------------------------------ quiz */
const dotsHtml = () => QUESTIONS.map((q, i) => `${i === 5 ? '<span class="gap"></span>' : ""}<span class="dot ${i < state.qi ? "done" : i === state.qi ? "cur" : ""}"></span>`).join("");
const answeredQ = (q) => (q.kind === "stage" ? q.id in state.answers.stage : q.metric in state.answers.ratings);

function viewQuiz() {
  return `<div class="qwrap"><div><div class="dots" id="dots">${dotsHtml()}</div><div class="card qcard enter" id="qcard">${qcard()}</div></div>
    <aside class="live" id="live"><div class="card"><h4><span class="tag-live"></span>Live read · life-cycle position</h4>
      ${plcChart([{ id: "you", label: "", t: 0.1, primary: true, hidden: true }], { mini: true, live: true })}<p id="livetxt">Answer the first questions and a marker will find its place on the curve.</p></div>
      <div class="card"><h4>Live radar · your ratings</h4><div id="liveradar"></div></div></aside></div>`;
}
function qcard() {
  const q = QUESTIONS[state.qi], n = QUESTIONS.length;
  const nav = `<div class="q-nav"><button class="btn ghost" data-action="back">← Back</button><button class="btn primary" data-action="next" ${answeredQ(q) ? "" : "disabled"}>${state.qi === n - 1 ? "Finish" : "Next"} →</button></div>`;
  if (q.kind === "stage") {
    const cur = state.answers.stage[q.id];
    return `<span class="partchip"><b>A</b> Read the stage · ${esc(q.signal)}</span><h2 class="qprompt">${esc(q.prompt)}</h2>
      <div class="stagechoices">${q.options.map((o, i) => `<button class="stagechoice ${cur === o.v ? "on" : ""}" data-action="answer" data-v="${o.v}"><span class="ic">${ICON[o.v]}</span><div><b>${esc(o.label)}</b>${o.sub ? `<span class="s">${esc(o.sub)}</span>` : ""}</div></button>`).join("")}</div>
      <button class="dk ${q.id in state.answers.stage && cur === null ? "on" : ""}" data-action="answer" data-v="__dk">Not sure</button>${nav}`;
  }
  const m = METRICS.find((x) => x.id === q.metric), cur = state.answers.ratings[q.metric], done = q.metric in state.answers.ratings;
  const picked = state.answers.causes[q.metric] || [];
  const detailsHtml = picked.map((cid) => { const c = CAUSE_BY_ID[cid]; if (!c.detail) return ""; const v = state.answers.details[cid] || "";
    return `<div class="detail"><label>${esc(c.label)}: ${esc(c.detail.prompt)}</label><select data-detail="${cid}"><option value="">Choose…</option>${c.detail.options.map((o) => `<option ${o === v ? "selected" : ""}>${esc(o)}</option>`).join("")}</select></div>`; }).join("");
  return `<span class="partchip"><b>B</b> Find the bottleneck · ${esc(m.short)}</span><h2 class="qprompt">${esc(q.prompt)}</h2>${q.hint ? `<p class="muted small">${esc(q.hint)}</p>` : ""}
    <div class="lvrow">${q.levels.map((l, i) => `<button class="lv ${cur === i + 1 ? "on" : ""}" data-action="rate" data-v="${i + 1}"><span class="bars5">${[1, 2, 3, 4, 5].map((k) => `<i class="${k <= i + 1 ? "f" : ""}" style="height:${8 + k * 5}px"></i>`).join("")}</span>${esc(l)}</button>`).join("")}</div>
    <button class="dk ${done && cur === null ? "on" : ""}" data-action="rate" data-v="__dk">Not sure</button>
    ${done ? `<div class="causes"><h3>${esc(q.causePrompt)}</h3><p class="muted small">Optional. Choose up to two; some ask for a detail.</p>
      <div class="chips">${q.causes.map((c) => `<button class="chip ${picked.includes(c.id) ? "on" : ""}" data-action="cause" data-c="${c.id}" ${picked.length >= 2 && !picked.includes(c.id) ? "disabled" : ""}>${esc(c.label)}</button>`).join("")}</div>${detailsHtml}</div>` : ""}${nav}`;
}
// redraw only the card (and the live panel), so the side marker can glide instead of restarting
function updateQuiz(dir) {
  const card = $("#qcard"); if (!card) return;
  card.className = "card qcard" + (dir === "fwd" ? " enter" : dir === "back" ? " enter-back" : "");
  card.innerHTML = qcard();
  $("#dots").innerHTML = dotsHtml();
  updateLive(true);
}
function updateLive(animate) {
  const votes = votesFrom(state.answers.stage), pos = votePosition(votes), mk = $("#live .mk");
  if (mk) {
    if (pos == null) mk.style.opacity = 0;
    else { const { x, y } = plcXY(pos); mk.style.opacity = 1; mk.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px)`; }
  }
  const total = Object.values(votes).reduce((a, b) => a + b, 0), top = Math.max(...Object.values(votes));
  const lead = STAGE_ORDER.filter((k) => votes[k] === top).map((k) => STAGE_NAME[k]).join(" / ");
  const tx = $("#livetxt"); if (tx) tx.innerHTML = total ? `Your ${total} signal${total > 1 ? "s" : ""} lean <b style="color:var(--accent-2)">${lead}</b>.` : "Answer the first questions and a marker will find its place on the curve.";
  const r = $("#liveradar");
  if (r) {
    const metrics = METRICS.map((m) => ({ ...m, data: { score: null }, student: state.answers.ratings[m.id] == null ? null : ((state.answers.ratings[m.id] - 1) / 4) * 100 }));
    const has = metrics.some((m) => m.student != null);
    r.innerHTML = has ? radarChart(metrics, { mini: true, showData: false, size: 300 }) : `<p class="small" style="margin:0">Rate the five metrics in part B and the shape fills in.</p>`;
    observe(r);
  }
}
function answer(raw) {
  const q = QUESTIONS[state.qi];
  state.answers.stage[q.id] = raw === "__dk" ? null : raw;
  persist(); updateQuiz(null);
  clearTimeout(answer.t); answer.t = setTimeout(next, 420);
}
function rate(raw) {
  const q = QUESTIONS[state.qi];
  state.answers.ratings[q.metric] = raw === "__dk" ? null : +raw;
  persist(); updateQuiz(null);
}
function next() {
  const q = QUESTIONS[state.qi];
  if (state.step !== "quiz" || !answeredQ(q)) return;
  const card = $("#qcard"); card?.classList.add("leave");
  setTimeout(() => { if (state.qi < QUESTIONS.length - 1) { state.qi++; updateQuiz("fwd"); } else go("about"); }, 240);
}
function back() {
  if (state.qi > 0) { state.qi--; updateQuiz("back"); } else go("home");
}

/* ------------------------------------------------------------------ about you */
function viewAbout() {
  const name = data.iims[state.iim].name;
  return `<div class="qwrap" style="grid-template-columns:minmax(0,760px);justify-content:center"><div class="card qcard enter" style="min-height:0">
    <span class="partchip"><b>✓</b> Last step</span><h2 class="qprompt">Ten answers in. Anything to add?</h2>
    <p class="muted">Both fields are optional and anonymous. They help us see whether first-years and final-years answer differently.</p>
    <div class="two" style="align-items:start;gap:14px">
      <div class="field"><label for="prog">Programme</label><select id="prog" data-meta="programme"><option value="">Prefer not to say</option>${PROGRAMMES.map((p) => `<option ${state.meta.programme === p ? "selected" : ""}>${esc(p)}</option>`).join("")}</select></div>
      <div class="field"><label for="yr">Year of study</label><select id="yr" data-meta="year"><option value="">Prefer not to say</option>${YEARS_OF_STUDY.map((p) => `<option ${state.meta.year === p ? "selected" : ""}>${esc(p)}</option>`).join("")}</select></div></div>
    <div class="field"><label for="cm">One change that would most improve ${esc(name)}</label><textarea id="cm" maxlength="300" data-meta="comment" placeholder="No names or personal details, please.">${esc(state.meta.comment || "")}</textarea></div>
    <div class="q-nav"><button class="btn ghost" data-action="backq">← Back</button><button class="btn primary mag" data-action="finish">Reveal my result →</button></div></div></div>`;
}
function finish() {
  const btn = $('[data-action="finish"]'); if (btn) { btn.disabled = true; btn.textContent = "Working it out…"; }
  if (!state.anonId) state.anonId = (crypto.randomUUID && crypto.randomUUID()) || String(Math.random()).slice(2) + Date.now();
  persist();
  if (apiOk) api.submit({ iim: state.iim, anonId: state.anonId, ...state.answers, ...state.meta, hp: "" });
  go("results", { fresh: true });
}
function showReveal() {
  const r = analyse(data, state.iim, state.answers), el = $("#reveal");
  el.innerHTML = `<div class="rings"><i></i><i></i><i></i></div><div><div class="lbl">Reading the signals</div><div class="big">${esc(r.stage?.stage || "Result")}</div><div class="nm">${esc(r.iim.name)}</div></div>`;
  el.classList.remove("on"); void el.offsetWidth; el.classList.add("on");
  setTimeout(() => el.classList.remove("on"), 3500);
}

/* ------------------------------------------------------------------ results */
const barRow = (label, cls, v) => `<div class="bar ${cls} ${v == null ? "none" : ""}"><span>${label}</span><div class="t"><i style="--w:${v == null ? 0 : Math.round(v)}%"></i></div><b ${v == null ? "" : `data-count="${Math.round(v)}"`}>${v == null ? "–" : "0"}</b></div>`;
function evidence(m, iim) {
  const d = m.data;
  if (d.score == null) return `No verified public figure yet (${esc(d.why.toLowerCase())}).`;
  const n = d.benchN, who = n === 3 ? "IIM A/B/C average" : `average of the ${n} IIM A/B/C with data`;
  switch (m.id) {
    case "salary": return `${fmt.lpa(d.own)} median (${d.year}) against ${fmt.lpa(d.bench)} at the ${who}. Basis: ${esc(iim.salaryBasis)}.`;
    case "roi": return `${fmt.num(d.own, 1)} months of gross payback: ₹${d.fee} L fee (${d.feeBatch} batch) against the ${d.year} median, versus ${fmt.num(d.bench, 1)} months at the ${who}.`;
    case "faculty": return `${fmt.pct(d.own)} of listed faculty hold a PhD (${d.year}) against ${fmt.pct(d.bench)} at the ${who}.`;
    case "research": return `${fmt.num(d.own)} journal articles per faculty (about ${Math.round(d.art)} a year over 2023-25 across ${d.fac} faculty) against ${fmt.num(d.bench)} at the ${who}. Counted from OpenAlex, so a lower bound.`;
    case "diversity": return `${fmt.pct(d.own)} women among PG students (${d.year}) against ${fmt.pct(d.bench)} at the ${who}; international share ${d.intl != null ? fmt.pct(d.intl, 2) : "n/a"}.`;
  }
  return "";
}
function narrative(r) {
  const s = r.stage;
  if (!s) return `<p>${esc(r.iim.name)} has no salary series in the dataset, so a data-based stage cannot be given.</p>`;
  let h = `<p style="font-size:1.15rem"><b>${esc(r.iim.name)}</b> is in the <b>${s.stage}</b> stage, and its momentum is <b>${s.momentum}</b>. ${esc(s.rule)}</p>`;
  if (s.yearsToParity) h += `<p class="muted">At ${fmt.pct(s.cagr)} a year against ${fmt.pct(s.abcCagr)} for IIM A/B/C, salary would reach the A/B/C level in roughly <b>${Math.round(s.yearsToParity)} years</b> (a straight-line projection, not a forecast). Closing the gap faster needs a change in strategy, not just more of the same.</p>`;
  return h;
}
function causeLines(metricId) {
  return (state.answers.causes[metricId] || []).map((cid) => { const c = CAUSE_BY_ID[cid]; return { id: cid, label: c.label, detail: state.answers.details[cid] }; });
}
const EVL = { official: "Official", report: "Report", news: "News", secondary: "Secondary", dataset: "Dataset" };
const KDL = { action: "Policy or programme", outcome: "Result only", reference: "Benchmark" };
function caseHtml(c) {
  return `<div class="case"><div class="case-h"><b>${esc(c.who)}</b>${c.own ? `<span class="pill good">Your institute</span>` : ""}<span class="pill k-${c.kind}">${KDL[c.kind]}</span><span class="pill e-${c.evidence}" data-tip="${esc(sol.evidence[c.evidence])}">${EVL[c.evidence]}</span></div>
    <p>${esc(c.what)}</p>${c.adapt ? `<p class="adapt"><b>How to use it:</b> ${esc(c.adapt)}</p>` : ""}<a class="src" href="${esc(c.src.u)}" target="_blank" rel="noopener noreferrer">${esc(c.src.t)} ↗</a></div>`;
}
function causeBlock(l, iimId) {
  const chk = causeCheck(data, iimId, l.id), all = casesFor(sol, l.id, l.detail, iimId, data), cases = all.slice(0, 4), rest = all.slice(4), gap = sol.gaps[l.id];
  return `<div class="cause2"><div class="cause-h"><b>→</b><span>${esc(l.label)}${l.detail ? ` <b>· ${esc(l.detail)}</b>` : ""}</span></div>
    ${chk ? `<div class="check ${chk.v}"><b>${{ supports: "Your data supports this", contradicts: "Your data does not back this", partial: "Partly checked" }[chk.v]}.</b> ${esc(chk.t)}</div>` : `<div class="check none">No public figure measures this directly, so it rests on student experience.</div>`}
    ${cases.length ? `<details class="fixes" open><summary>What comparable institutes did <span class="faint">(${all.length})</span></summary><div class="cgrid">${cases.map(caseHtml).join("")}</div>${rest.length ? `<details class="more"><summary>Show ${rest.length} more</summary><div class="cgrid">${rest.map(caseHtml).join("")}</div></details>` : ""}</details>` : ""}
    ${gap ? `<p class="gap"><b>Not documented:</b> ${esc(gap)}</p>` : ""}</div>`;
}
// no cause named for a bottleneck: show the best-documented fixes for that metric instead
function fallbackFixes(m, iimId) {
  const ids = CAUSES[m.id].map((c) => c.id), seen = new Set(), cases = [];
  for (const id of ids) for (const c of casesFor(sol, id, "", iimId, data)) if (!seen.has(c.id)) { seen.add(c.id); cases.push(c); }
  cases.sort((a, b) => ["official", "report", "dataset", "news", "secondary"].indexOf(a.evidence) - ["official", "report", "dataset", "news", "secondary"].indexOf(b.evidence));
  return `<p class="small faint" style="margin-top:6px">You named no cause, so these are the best-documented fixes for this metric.</p>${cases.length ? `<details class="fixes" open><summary>What comparable institutes did <span class="faint">(${Math.min(cases.length, 4)})</span></summary><div class="cgrid">${cases.slice(0, 4).map(caseHtml).join("")}</div></details>` : ""}`;
}
// causes the student named for metrics that are not ranked as bottlenecks still get checked and matched
function otherCauses(r, iim) {
  const shown = new Set([...r.bottlenecks, ...r.concerns].map((m) => m.id));
  const rows = r.metrics.filter((m) => !shown.has(m.id) && causeLines(m.id).length);
  if (!rows.length) return "";
  return `<div class="card rv" style="margin-top:18px"><span class="eyebrow">Other causes you named</span>
    <p class="muted small">These metrics are not among the weakest, but you named causes for them, so they are checked the same way.</p>
    ${rows.map((m) => `<h3 style="font-size:1.25rem;margin-top:16px">${esc(m.label)} <span class="tag ${m.tag}">${m.tag}</span></h3>${causeLines(m.id).map((l) => causeBlock(l, iim.id)).join("")}`).join("")}</div>`;
}
function bnCard(m, iim, concern = false) {
  const lines = causeLines(m.id), q = QUESTIONS.find((x) => x.metric === m.id);
  return `<div class="card rv ${concern ? "unv" : ""}"><span class="eyebrow">${concern ? "Raised by students · no public data to check it" : "Bottleneck"}</span><h3 style="font-size:1.6rem">${esc(m.label)}</h3>
    <div class="sev"><i style="--w:${Math.round(m.severity)}%"></i></div>
    <p class="small muted" style="margin-bottom:8px"><b>What the data says.</b> ${evidence(m, iim)}</p>
    ${m.rating ? `<p class="small muted" style="margin-bottom:10px"><b>What you said.</b> ${esc(q.levels[m.rating - 1])} (${m.rating}/5).</p>` : ""}
    <p class="small" style="margin-bottom:0"><b>Specific causes you named</b></p>
    ${lines.length ? lines.map((l) => causeBlock(l, iim.id)).join("") : fallbackFixes(m, iim.id)}</div>`;
}

/* ------------------------------------------------------------------ diagnosis + playbooks */
const GL = { global: "Global leader", "leading-iim": "Leading IIM", peer: "Peer IIM" };
const stageCode = (name) => ({ Growth: "growth", Maturity: "maturity", Decline: "decline" }[name]);
function ageChip(a, age) {
  if (a.ageThen === 0) return `At founding · you ${age}`;
  if (a.ageThen == null) return "Established school";
  const d = a.ageThen - age, rel = Math.abs(d) <= 4 ? "Similar age" : d < 0 ? "Earlier stage" : "Later stage";
  return `${rel} · ${a.ageThen} vs ${age} yrs`;
}
function analogHtml(a, age) {
  const srcs = [].concat(a.src);
  return `<article class="analog"><header class="an-h"><b>${esc(a.school)}</b><span class="when">${esc(a.when)}</span></header>
    <div class="an-pills"><span class="pill grp-${a.group}">${GL[a.group]}</span><span class="pill match">${ageChip(a, age)}</span><span class="pill e-${a.evidence}" data-tip="${esc(sol.evidence[a.evidence])}">${EVL[a.evidence]}</span></div>
    <p><b class="lb">Faced</b>${esc(a.situation)}</p>
    <div class="did-w"><b class="lb">Did</b><ul class="did">${a.did.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>
    <p class="res"><b class="lb">Result</b>${esc(a.result)}</p>${a.caveat ? `<p class="cav">${esc(a.caveat)}</p>` : ""}
    <div class="srcs">${srcs.map((x) => `<a class="src" href="${esc(x.u)}" target="_blank" rel="noopener noreferrer">${esc(x.t)} ↗</a>`).join("")}</div></article>`;
}
function playbookCard(pid, probs, age, stage) {
  const book = pb.playbooks[pid], ac = book.analogs;
  const sorted = [...ac].sort((a, b) => (a.stage === stage ? 0 : 1) - (b.stage === stage ? 0 : 1) || Math.abs(a.ageThen - age) - Math.abs(b.ageThen - age));
  const same = ac.filter((a) => a.stage === stage).length;
  const n = sorted.length === 3 ? 3 : Math.min(sorted.length, 4), first = sorted.slice(0, n), rest = sorted.slice(n);
  return `<div class="card playbook rv"><span class="eyebrow">Playbook</span><h3 style="font-size:1.55rem">${esc(book.title)}</h3>
    <div class="chips" style="margin:10px 0 4px">${probs.map((p) => `<span class="pill">fixes: ${esc(p.title)}</span>`).join("")}</div>
    <p class="muted small">${esc(book.why)}</p>
    ${same ? "" : `<p class="check partial"><b>No stage-matched analogue found.</b> No documented case in this playbook was at your stage (${esc(stage)}), so these are the closest, with their own stage shown.</p>`}
    <div class="agrid">${first.map((a) => analogHtml(a, age)).join("")}</div>
    ${rest.length ? `<details class="more"><summary>Show ${rest.length} more</summary><div class="agrid">${rest.map((a) => analogHtml(a, age)).join("")}</div></details>` : ""}
    <p class="gap"><b>Not documented:</b> ${esc(book.notDocumented)}</p></div>`;
}
function diagnosisSection(iim) {
  const dg = diagnose(data, iim.id), stage = stageCode(dg.stage), age = dg.age, top = dg.problems.slice(0, 5);
  const weight = new Map();
  top.forEach((p) => p.playbooks.forEach((id) => { const w = weight.get(id) || { sev: 0, probs: [] }; w.sev = Math.max(w.sev, p.severity); w.probs.push(p); weight.set(id, w); }));
  const books = [...weight.entries()].sort((a, b) => b[1].sev - a[1].sev).slice(0, 4);
  return `<section><span class="eyebrow rv">What the data says is wrong</span>
    <h2 class="sec rv">${esc(iim.name)}'s problems, ranked from its own numbers</h2>
    <p class="muted rv" style="max-width:66ch">Each problem is measured against the IIM A/B/C average and the other IIMs. ${esc(iim.name)} is ${age} years old and in the <b>${esc(dg.stage)}</b> stage, so the playbooks below favour schools that faced the same problem at a similar age.</p>
    ${top.length ? `<div class="probs">${top.map((p) => `<div class="card prob rv"><div class="prob-h"><h3>${esc(p.title)}</h3><span class="sevn">${p.severity}</span></div>
      <div class="sev"><i style="--w:${p.severity}%"></i></div><ul class="ev">${p.evidence.map((e) => `<li>${esc(e)}</li>`).join("")}</ul></div>`).join("")}</div>`
      : `<div class="card rv"><b>No problem stands out against the benchmark.</b> Every measured metric is at or near the IIM A/B/C level.</div>`}
    ${dg.notes.map((n) => `<p class="faint small rv" style="margin-top:10px">${esc(n)}</p>`).join("")}
    ${books.length ? `<span class="eyebrow rv" style="margin-top:34px">How leaders fixed the same problems at your stage</span>${books.map(([id, w]) => playbookCard(id, w.probs, age, stage)).join("")}` : ""}</section>`;
}
function viewResults() {
  const r = analyse(data, state.iim, state.answers), s = r.stage, id = state.iim, iim = r.iim;
  const hasStudent = Object.values(state.answers.ratings).some((v) => v != null) || Object.keys(state.answers.stage).length;
  const markers = stageBoard(data).map((b) => ({ id: b.id, label: b.id === id ? `${nick(id)} · you are here` : nick(b.id), t: b.t, primary: b.id === id, tip: `<b>${esc(data.iims[b.id].name)}</b><br>${b.stage} · ${b.momentum}` }));
  const sv = r.studentView;
  const agree = !hasStudent ? `<span class="pill warn">Data only: answer the questions to add the student view</span>`
    : sv ? (r.agree ? `<span class="pill good">Students agree: ${sv.stage}</span>` : `<span class="pill warn">Students read it as ${sv.stage}; the data says ${s?.stage}</span>`) : "";
  const votes = votesFrom(state.answers.stage), tot = Object.values(votes).reduce((a, b) => a + b, 0);
  const voteBlock = tot ? `<div class="card rv"><span class="eyebrow">Part A · how your five signals voted</span>
      <div class="votes">${STAGE_ORDER.map((k) => (votes[k] ? `<i class="v-${k}" style="flex:${votes[k]}" data-tip="${STAGE_NAME[k]}: ${votes[k]} of ${tot}"></i>` : "")).join("")}</div>
      <div class="vlegend">${STAGE_ORDER.map((k) => `<span><i class="v-${k}" style="background:${{ intro: "#8fc3ff", growth: "#7ff0b2", mature: "#ffd37a", decline: "#ff8e8e" }[k]}"></i>${STAGE_NAME[k]} ${votes[k]}</span>`).join("")}</div>
      <ul class="ev">${STAGE_QUESTIONS.filter((q) => state.answers.stage[q.id]).map((q) => { const o = q.options.find((x) => x.v === state.answers.stage[q.id]); return `<li><b>${esc(q.signal)}</b>: ${esc(o.label)} <span class="badge stage-${o.v}" style="margin:0 0 0 6px">${STAGE_NAME[o.v]}</span></li>`; }).join("")}</ul></div>` : "";
  const pilot = data.pilot?.iim === id ? pilotBlock() : "";
  return `
  <section><div class="card rv in" style="padding:clamp(22px,4vw,44px)">
    <span class="eyebrow">Result · ${esc(iim.name)}</span>
    <div class="stage-title"><h2>${s ? s.stage : "No stage"}</h2>${s ? `<span class="pill">Momentum: ${s.momentum}</span>` : ""}${agree}</div>
    ${narrative(r)}
    <div style="margin-top:12px">${plcChart(markers, { compact: true })}</div>
    ${s ? `<ul class="ev">${s.evidence.map((e) => `<li>${esc(e)}</li>`).join("")}</ul>` : ""}
    <div class="row no-print" style="margin-top:24px"><button class="btn primary" data-action="print">Print or save as PDF</button><button class="btn" data-action="copy">Copy summary</button><button class="btn ghost" data-action="retake">Retake the questions</button></div>
  </div>${voteBlock}</section>

  ${diagnosisSection(iim)}

  <section><span class="eyebrow rv">Strengths and weaknesses</span>
    <div class="card two rv"><div>${radarChart(r.metrics)}<div class="legend"><span><i style="background:var(--accent-2)"></i>Public data (0–100 vs IIM A/B/C)</span><span><i style="background:var(--accent)"></i>Student rating</span></div></div>
    <div><h3 style="font-size:1.4rem">Strengths</h3><ul class="sw s">${r.strengths.length ? r.strengths.map((m) => `<li><span>${esc(m.label)}</span><b>${Math.round(m.composite)}</b></li>`).join("") : `<li><span class="muted">None scores 70 or more yet.</span></li>`}</ul>
      <h3 style="font-size:1.4rem">Weaknesses</h3><ul class="sw w">${r.weaknesses.length ? r.weaknesses.map((m) => `<li><span>${esc(m.label)}</span><b>${Math.round(m.composite)}</b></li>`).join("") : `<li><span class="muted">None scores below 50.</span></li>`}</ul>
      <p class="faint small">Blended score = ${BLEND.data * 100}% public data + ${BLEND.student * 100}% student rating. Where one side is missing, the other is used alone.</p></div></div></section>

  <section><span class="eyebrow rv">Metric by metric</span><div class="card">
    ${r.metrics.map((m) => `<div class="mrow rv"><div><h3>${esc(m.short)}<span class="tag ${m.tag}">${m.tag}</span></h3><p class="small faint" style="margin-top:6px">${esc(m.uses)}</p></div>
      <div><div class="bars">${barRow("Data", "d", m.data.score)}${barRow("Students", "s", m.student)}${barRow("Blended", "c", m.composite)}</div>
      <p class="note">${evidence(m, iim)}</p>
      ${m.basis === "students" ? `<p class="note" style="color:var(--warn)">Only the student view exists for this metric, so there is no public benchmark to check it against.</p>` : ""}
      ${m.gap != null && Math.abs(m.gap) >= 20 ? `<p class="note" style="color:var(--accent-2)">Perception gap: students rate this ${m.gap > 0 ? "higher" : "lower"} than the data does (${Math.abs(Math.round(m.gap))} points apart).</p>` : ""}</div></div>`).join("")}
  </div></section>

  <section><span class="eyebrow rv">Bottlenecks to fix first</span>
    <div class="bn">${r.bottlenecks.length ? "" : `<div class="card rv" style="grid-column:1/-1"><h3 style="font-size:1.4rem">No data-backed bottleneck below ${THRESHOLDS.bottleneckBelow}</h3><p class="muted small" style="margin:8px 0 0">Every metric public data covers scores ${THRESHOLDS.bottleneckBelow} or more against the IIM A/B/C benchmark.</p></div>`}${r.bottlenecks.map((m) => bnCard(m, iim)).join("")}${r.concerns.map((m) => bnCard(m, iim, true)).join("")}</div>
    ${otherCauses(r, iim)}</section>

  <section id="community"></section>${pilot}

  <section><span class="eyebrow rv">Behind the numbers</span><div class="card rv">
    <details open><summary>How the stage is decided</summary><p class="muted small" style="margin-top:10px">Salary is compared with the average of IIM Ahmedabad, Bangalore and Calcutta in the same year. Below <b>${THRESHOLDS.growthBelow * 100}%</b> of that level the institute is in <b>Growth</b>; <b>${THRESHOLDS.growthBelow * 100}–${THRESHOLDS.maturityFrom * 100}%</b> is late growth or early maturity depending on recent growth; <b>${THRESHOLDS.maturityFrom * 100}%+</b> is <b>Maturity</b>. A fall of more than ${Math.abs(THRESHOLDS.declineDrop) * 100}% over about three years marks <b>Decline</b>. The students' Part A signals are a cross-check; they do not change the data stage.</p></details>
    <details><summary>Data quality flags for ${esc(iim.name)}</summary><ul class="ev" style="margin-top:10px">${(iim.dataFlags.length ? iim.dataFlags : ["No conflicts recorded in the workbook."]).map((f) => `<li>${esc(f)}</li>`).join("")}</ul>${iim.notes.length ? `<p class="small faint" style="margin-top:12px"><b>Notes from the workbook</b></p><ul class="ev">${iim.notes.map((f) => `<li>${esc(f)}</li>`).join("")}</ul>` : ""}</details>
    <details><summary>How each number is measured</summary><ul class="ev" style="margin-top:10px">${Object.entries(data.method).filter(([k]) => k !== "removed" && k !== "commonYear").map(([k, v]) => `<li><b>${esc(k)}</b>: ${esc(v)}</li>`).join("")}<li><b>Comparison year</b>: ${data.method.commonYear} for every IIM, so all are compared on the same batch.</li></ul>
      ${iim.fee ? `<p class="note">Fee used: ₹${iim.fee.lakh} L for the ${esc(iim.fee.batch)} batch (${esc(iim.fee.source)}). ${esc(iim.fee.note || "")}</p>` : ""}</details>
    <details><summary>Sources (${iim.sources.length})</summary><table><tbody>${iim.sources.map((x) => `<tr><td>${esc(x.id)}</td><td>${esc(x.title)}</td><td>${esc(x.quality || "")}</td></tr>`).join("")}</tbody></table></details>
  </div></section>`;
}
function pilotBlock() {
  const p = data.pilot;
  const items = p.items.map((it) => `<div class="pilot-row"><span>${esc(it.item)}</span><div class="t"><i style="--w:${(it.mean / 5) * 100}%"></i></div><b>${it.mean.toFixed(1)}</b></div>`).join("");
  const q = p.suggestions.slice(0, 4).map((s) => `<div class="quote">“${esc(s)}”</div>`).join("");
  const tr = Object.entries(p.tradeoffs).map(([k, v]) => `<tr><td>${esc(k.replace(/\?$/, ""))}</td><td>${esc(v[0].choice)} (${Math.round(v[0].share * 100)}%)</td></tr>`).join("");
  return `<section><span class="eyebrow rv">Pilot survey · IIM Sirmaur · ${p.n} students</span>
    <div class="card rv"><h3 style="font-size:1.7rem;margin-bottom:6px">How Sirmaur students rate 14 areas</h3>
    <p class="muted small">Mean rating from 1 (very poor) to 5 (excellent), weakest first. ${Object.entries(p.programmes).map(([k, v]) => `${v} ${esc(k)}`).join(", ")}. Mostly 2nd-year students, so read this as a pilot, not a census.</p>${items}
    <p class="small muted" style="margin-top:14px">Likelihood to recommend: <b>${p.recommend.mean}</b> on the form's 0–10 scale (${p.recommend.n} answers).</p>
    <details><summary>What students would trade off</summary><table><tbody>${tr}</tbody></table></details>${q ? `<details open><summary>In their words</summary>${q}</details>` : ""}</div></section>`;
}
async function afterResults() {
  const el = $("#community"); if (!el || !apiOk) return;
  const agg = await api.aggregate(state.iim);
  if (!agg || state.step !== "results") return;
  if (agg.n < 5) {
    el.innerHTML = `<span class="eyebrow rv">Combined student view</span><div class="card hold rv" style="margin-top:0 !important"><b>${agg.n} student${agg.n === 1 ? "" : "s"} so far.</b><br><span class="small">The combined view appears at 5 responses, to keep answers anonymous. Share the link with classmates.</span><div style="margin-top:14px"><button class="btn" data-action="share">Copy link for students</button></div></div>`;
    observe(el); return;
  }
  const crowd = analyse(data, state.iim, aggregateToAnswers(agg));
  const causes = Object.entries(agg.causeCounts || {}).flatMap(([m, o]) => Object.entries(o).map(([c, n]) => ({ c, n }))).sort((a, b) => b.n - a.n).slice(0, 6);
  const lines = causes.map((x) => { const top = Object.entries(agg.detailCounts?.[x.c] || {}).sort((a, b) => b[1] - a[1])[0]; return `<li>${esc(CAUSE_BY_ID[x.c].label)}${top ? ` <b>· mostly ${esc(top[0])}</b>` : ""} <span class="faint">(${x.n})</span></li>`; });
  el.innerHTML = `<span class="eyebrow rv">Combined student view · ${agg.n} students</span><div class="card rv">
    <div class="stage-title"><h3 style="font-size:1.7rem">Students collectively see</h3>${crowd.studentView ? `<span class="pill">${crowd.studentView.stage} · ${crowd.studentView.momentum}</span>` : ""}
    ${crowd.agree != null ? `<span class="pill ${crowd.agree ? "good" : "warn"}">${crowd.agree ? "Matches the data" : "Differs from the data"}</span>` : ""}</div>
    <div class="bars" style="margin-top:16px">${crowd.metrics.map((m) => barRow(m.short, "s", m.student)).join("")}</div>
    ${lines.length ? `<p class="small" style="margin:18px 0 6px"><b>Most-named causes</b></p><ul class="ev">${lines.join("")}</ul>` : ""}</div>`;
  observe(el);
}

/* ------------------------------------------------------------------ actions */
function summaryText() {
  const r = analyse(data, state.iim, state.answers), s = r.stage;
  return [`${r.iim.name}: ${s ? `${s.stage} stage, ${s.momentum}` : "no stage"}.`, s ? s.rule : "",
    `Strengths: ${r.strengths.map((m) => m.short).join(", ") || "none yet"}.`, `Weaknesses: ${r.weaknesses.map((m) => m.short).join(", ") || "none"}.`,
    `Top bottlenecks: ${r.bottlenecks.map((m) => m.label).join("; ") || "none below 65"}.`,
    ...r.bottlenecks.flatMap((m) => causeLines(m.id).map((l) => `  - ${m.short}: ${l.label}${l.detail ? ` (${l.detail})` : ""}`))].filter(Boolean).join("\n");
}
const shareUrl = () => `${location.origin}${location.pathname}?iim=${state.iim}`;
const copy = async (t, msg) => { try { await navigator.clipboard.writeText(t); toast(msg); } catch { toast("Copy blocked by the browser"); } };

document.addEventListener("click", (e) => {
  if (e.target.closest("#demo")) return;
  const el = e.target.closest("[data-action]");
  if (!el) { const d = e.target.closest(".plc-dot, .plc-lbl"); if (d && state.step === "home") pick(d.dataset.id, e.clientX, e.clientY); return; }
  const a = el.dataset.action;
  if (a === "home") return go("home");
  if (a === "demo") return openDemo();
  if (a === "pick") return pick(el.dataset.id, e.clientX, e.clientY);
  if (a === "start") { const i = QUESTIONS.findIndex((q) => !answeredQ(q)); return go("quiz", { qi: i < 0 ? 0 : i }); }
  if (a === "preview") return go("results");
  if (a === "answer") return answer(el.dataset.v);
  if (a === "rate") return rate(el.dataset.v);
  if (a === "next") return next();
  if (a === "back") return back();
  if (a === "backq") return go("quiz", { qi: QUESTIONS.length - 1 });
  if (a === "cause") {
    const m = QUESTIONS[state.qi].metric, list = (state.answers.causes[m] ||= []), i = list.indexOf(el.dataset.c);
    if (i >= 0) { list.splice(i, 1); delete state.answers.details[el.dataset.c]; } else if (list.length < 2) list.push(el.dataset.c);
    persist(); const y = scrollY; updateQuiz(null); return scrollTo(0, y);
  }
  if (a === "finish") return finish();
  if (a === "print") return print();
  if (a === "copy") return copy(summaryText(), "Summary copied");
  if (a === "share") return copy(shareUrl(), "Link copied: it opens this IIM's theme");
  if (a === "retake") { state.answers = empty(); persist(); return go("quiz", { qi: 0 }); }
});
document.addEventListener("input", (e) => { const k = e.target.dataset?.meta; if (k) { state.meta[k] = e.target.value; persist(); } });
document.addEventListener("change", (e) => {
  const c = e.target.dataset?.detail; if (!c) return;
  if (e.target.value) state.answers.details[c] = e.target.value; else delete state.answers.details[c];
  persist();
});
document.addEventListener("keydown", (e) => {
  if (state.step !== "quiz" || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
  const q = QUESTIONS[state.qi];
  if (/^[1-5]$/.test(e.key)) { const k = +e.key; if (q.kind === "stage" && q.options[k - 1]) return answer(q.options[k - 1].v); if (q.kind === "metric") return rate(String(k)); }
  if (e.key === "Enter") return next();
  if (e.key === "ArrowLeft") return back();
});

boot();
