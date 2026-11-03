// Presentation mode: full-screen slides synced to the 3-minute spoken script.
// Keys: → / Space / Enter next build or slide · ← back · A auto-play on the script's timing · N speaker notes · F full screen · Esc exit
import { stageBoard, stageFromData, dataScores } from "./engine.js";
import { METRICS, STAGE_QUESTIONS } from "./questions.js";
import { plcChart } from "./charts.js";
import { applyTheme } from "./themes.js";
import { observe } from "./fx.js";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const TOTAL = 185;                                   // seconds: the script runs about 3:05
const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.max(0, Math.floor(s % 60))).padStart(2, "0")}`;

export function startDemo({ data, pb, nick, onExit, onLive, onGuided }) {
  const ID = "sirmaur", I = data.iims[ID], S = I.series;
  applyTheme(ID);
  const st = stageFromData(data, ID), ds = dataScores(data, ID);
  const P = (x, d = 0) => (x * 100).toFixed(d) + "%";
  const bar = (label, val, w, cls = "") => `<div class="d-row ${cls}"><span>${label}</span><div class="d-bar"><i style="--w:${w}%"></i></div><b>${val}</b></div>`;

  const ORDER = ["sirmaur", "ahmedabad", "bangalore", "calcutta", "ranchi", "jammu", "sambalpur", "shillong"];
  const short = (id) => data.iims[id].name.replace("IIM ", "");
  const rows = [
    { id: "salary", label: "Salary", val: `₹${ds.salary.own} L vs ₹${ds.salary.bench.toFixed(1)} L`, score: ds.salary.score },
    { id: "roi", label: "ROI", val: `${ds.roi.own.toFixed(1)} vs ${ds.roi.bench.toFixed(1)} months to recover the fee`, score: ds.roi.score },
    { id: "faculty", label: "Faculty Ph.D.", val: `${P(ds.faculty.own, 1)} vs ${P(ds.faculty.bench, 1)}`, score: ds.faculty.score },
    { id: "research", label: "Research", val: `${ds.research.own.toFixed(2)} vs ${ds.research.bench.toFixed(2)} articles per faculty`, score: ds.research.score },
    { id: "diversity", label: "Diversity", val: `${P(ds.diversity.own, 1)} women · ${P(ds.diversity.intl, 1)} international`, score: ds.diversity.score },
  ];
  const bottlenecks = rows.filter((r) => r.score < 65).sort((a, b) => a.score - b.score).slice(0, 2);
  const LIVE_URL = "https://9cigars.github.io/StageFinder/";
  const SIGNALS = STAGE_QUESTIONS.map((q) => q.signal);

  const SCENES = [
    { id: "intro", at: 0, label: "What it is", concept: "StageFinder · What it is", steps: 2,
      notes: "To make our analysis reusable, I built StageFinder. It is a ten-question tool that tells you which life-cycle stage an IIM is in, what it does well, and what is holding it back. It covers eight IIMs: Sirmaur, Ahmedabad, Bangalore, Calcutta, Ranchi, Jammu, Sambalpur and Shillong.",
      html: () => `<div class="d-title"><h1>Stage<em>Finder</em></h1><p class="d-sub">A <b>ten-question</b> tool that places an IIM on its life cycle</p>
        <div class="d-chips b" data-s="1"><span>Which life-cycle stage</span><span>What it does well</span><span>What is holding it back</span></div>
        <div class="d-chips b" data-s="2">${ORDER.map((id) => `<span>${esc(short(id))}</span>`).join("")}</div></div>` },
    { id: "metrics", at: 20, label: "Metrics", concept: "How we chose the metrics", steps: 3,
      notes: "We picked measures that global rankings such as QS and the Financial Times treat as important, and whose data is public and verifiable. That gave five: median salary, return on investment, faculty with PhDs, research output per faculty, and diversity, meaning women and international students. Each carries an equal weight of twenty percent.",
      html: () => `<h2 class="d-h">Five measures that global rankings value, from <em>public, verifiable data</em></h2>
        <div class="d-chips b" data-s="1" style="justify-content:flex-start"><span>Important to QS and the Financial Times</span><span>Data is public</span><span>Data is verifiable</span></div>
        <div class="d-metrics b" data-s="2">${METRICS.map((m, k) => `<div class="d-mc"><i>${k + 1}</i><b>${esc(m.label)}</b><span>${esc(m.uses)}</span><em class="b" data-s="3">20%</em></div>`).join("")}</div>
        <p class="d-foot b" data-s="3" style="text-align:center">Equal weights: five metrics, 20% each.</p>` },
    { id: "data", at: 55, label: "Data", concept: "How we use the data", steps: 3,
      notes: "For each IIM we collected 2021 to 2026 figures from NIRF filings and placement reports. We benchmark every institute against the average of IIM Ahmedabad, Bangalore and Calcutta, and score each metric from zero to one hundred against that average. For example, Sirmaur's median salary of fourteen point two lakh is roughly forty-two percent of that benchmark.",
      html: () => `<h2 class="d-h">Every IIM is scored 0 to 100 against the <em>A/B/C average</em></h2>
        <div class="d-split even"><div class="d-card"><h3 class="d-h3">Sirmaur's score on each metric <small>(100 = the benchmark)</small></h3>${rows.map((r) => bar(r.label, r.val, r.score)).join("")}</div>
        <div class="d-col d-even"><div class="d-stat b" data-s="1"><b>2021–2026</b><span>figures per IIM, from NIRF filings and placement reports</span></div>
          <div class="d-stat b" data-s="2"><b>A + B + C</b><span>IIM Ahmedabad, Bangalore and Calcutta: their average is the benchmark</span></div>
          <div class="d-stat hot b" data-s="3"><b>${P(st.level)}</b><span>Sirmaur's median salary, ₹${ds.salary.own} L against ₹${ds.salary.bench.toFixed(1)} L</span></div></div></div>` },
    { id: "stage", at: 90, label: "Stage rule", concept: "How we interpret it · the stage", steps: 5,
      notes: "The stage comes from the data. Salary below seventy percent of the benchmark means Growth. Between seventy and eighty-five percent, it depends on recent growth. Above eighty-five percent is Maturity. A fall of more than three percent signals Decline, unless it is only dilution from a bigger class. By this rule, Sirmaur is in Growth.",
      html: () => `<h2 class="d-h">The stage comes from the <em>data</em>: salary against the benchmark</h2>
        <div class="d-card"><div class="d-gauge"><i class="g" style="flex:70"></i><i class="m" style="flex:15"></i><i class="x" style="flex:15"></i>
          <span class="pin b" data-s="5" style="left:${Math.min(98, st.level * 100)}%"><b>Sirmaur ${P(st.level)}</b></span></div>
          <div class="d-ticks"><span style="left:0">0%</span><span style="left:70%">70%</span><span style="left:85%">85%</span><span style="left:100%">100%</span></div></div>
        <div class="d-rules">
          <div class="d-rc b" data-s="1"><b>Below 70%</b><span>Growth</span></div>
          <div class="d-rc b" data-s="2"><b>70 to 85%</b><span>Depends on recent growth</span></div>
          <div class="d-rc b" data-s="3"><b>Above 85%</b><span>Maturity</span></div>
          <div class="d-rc b" data-s="4"><b>Fall of more than 3%</b><span>Decline, unless a bigger class explains it</span></div></div>
        <div class="d-verdict b" data-s="5" style="margin-top:16px">By this rule Sirmaur is in <b>${esc(st.stage)}</b></div>` },
    { id: "students", at: 115, label: "Student view", concept: "How we interpret it · the student view", steps: 5,
      notes: "Then students add their view. Five questions, on reputation, recruiters, processes, faculty and salary direction, each vote for a stage, and the tool shows whether students and data agree. Five more questions rate each metric and name the cause, such as which department or which sector. Final scores blend sixty percent data and forty percent student rating. Above seventy is a strength; below fifty is a weakness.",
      html: () => `<h2 class="d-h">Then <em>students add their view</em></h2>
        <div class="d-split even">
          <div class="d-card b" data-s="1"><h3 class="d-h3">Part A · five questions, each votes for a stage</h3><div class="d-kpi" style="margin:10px 0 0">${SIGNALS.map((s) => `<span>${esc(s)}</span>`).join("")}</div>
            <p class="d-agree b" data-s="2">The tool shows whether students and data <b>agree</b>.</p></div>
          <div class="d-card b" data-s="3"><h3 class="d-h3">Part B · five questions rate each metric and name the cause</h3><p class="d-note" style="margin:8px 0 0">Which department lacks faculty? Which sector is missing from recruiters?</p></div></div>
        <div class="d-duo"><div class="d-blend b" data-s="4"><i style="flex:60"><b>60%</b> data</i><i style="flex:40"><b>40%</b> students</i></div>
          <div class="d-tags b" data-s="5"><span class="good"><b>Above 70</b> Strength</span><span class="bad"><b>Below 50</b> Weakness</span></div></div>` },
    { id: "demo", at: 140, label: "Live demo", concept: "Live demo", steps: 3,
      notes: "[Open Presentation mode, pick Sirmaur, point to the live stage board, then show the bottlenecks result.]",
      html: () => { const board = stageBoard(data).map((b) => ({ id: b.id, label: b.id === ID ? "Sirmaur · you are here" : nick(b.id), t: b.t, primary: b.id === ID, tip: `${esc(data.iims[b.id].name)}: ${b.stage}` }));
        return `<h2 class="d-h">Pick <em>Sirmaur</em>: the live stage board, then the bottlenecks</h2>
        <div class="d-split"><div class="d-card d-chart">${plcChart(board)}</div>
        <div class="d-col"><div class="d-stat b" data-s="1"><b>${esc(st.stage)}</b><span>Sirmaur's stage on the live board, ${P(st.level)} of the benchmark</span></div>
          <div class="d-card b" data-s="2"><h3 class="d-h3">Bottlenecks <small>(data score below 65)</small></h3>${bottlenecks.map((r) => bar(r.label, r.val, r.score, "pr")).join("") || `<p class="d-note">No metric scores below 65.</p>`}</div>
          <div class="b row" data-s="3"><button class="btn primary" data-d="guided">▶ Run the live demo</button><button class="btn" data-d="live">Open the live site ↗</button></div></div></div>`; } },
    { id: "close", at: 170, label: "Close", concept: "Limits and close", steps: 2,
      notes: "Student responses are exploratory, and salary definitions differ across IIMs, so results are indicative. Run each year, StageFinder becomes our continuous-improvement check. Scan the code and try it on your own IIM. Thank you.",
      after: () => makeQR(),
      html: () => `<div class="d-title"><h1>Thank <em>you</em></h1>
        <div class="d-chips b" data-s="1"><span>Student responses are exploratory</span><span>Salary definitions differ across IIMs, so results are indicative</span></div>
        <div class="d-end b" data-s="2"><div class="d-qr" id="dqr"></div><div><p class="d-sub" style="margin:0 0 10px;text-align:left">Run it each year: a <b>continuous-improvement check</b>.<br>Scan the code and try it on your own IIM.</p><b class="d-url">9cigars.github.io/StageFinder</b></div></div></div>` },
  ];

  function makeQR() {
    const box = root.querySelector("#dqr"); if (!box) return;
    const draw = () => { try { const q = window.qrcode(0, "M"); q.addData(LIVE_URL); q.make(); box.innerHTML = q.createSvgTag({ cellSize: 6, margin: 2, scalable: true }); } catch { box.remove(); } };
    if (window.qrcode) return draw();
    const s = document.createElement("script"); s.src = "https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js"; s.onload = draw; s.onerror = () => box.remove(); document.head.appendChild(s);
  }

  /* ---------------- shell ---------------- */
  const root = document.createElement("div");
  root.id = "demo"; root.className = "demo"; root.setAttribute("role", "dialog"); root.setAttribute("aria-label", "Presentation mode");
  root.innerHTML = `<div class="d-top"><span class="d-kick" id="dk"></span><div class="d-clock"><span id="dpace"></span><b id="dclock">0:00</b><small> / ${mmss(TOTAL)}</small></div><button class="d-btn" data-d="exit" aria-label="Exit presentation">✕</button></div>
    <div class="d-stage" id="dstage"></div><div class="d-notes" id="dnotes" hidden></div>
    <div class="d-bot"><div class="d-track" id="dtrack">${SCENES.map((s, i) => `<button data-d="go" data-i="${i}" style="flex:${((SCENES[i + 1]?.at ?? TOTAL) - s.at)}"><i></i><span>${s.label}</span><small>${mmss(s.at)}</small></button>`).join("")}</div>
      <div class="d-ctl"><button class="d-btn" data-d="prev">‹</button><span id="dcount"></span><button class="d-btn" data-d="next">›</button><button class="d-btn wide" data-d="auto" id="dauto">▶ Auto</button><button class="d-btn wide" data-d="notes">Notes</button><button class="d-btn" data-d="fs" aria-label="Full screen">⛶</button></div></div>`;
  document.body.appendChild(root);
  document.documentElement.classList.add("demo-open");
  const $ = (s) => root.querySelector(s);
  let i = 0, step = 0, t0 = null, auto = false, tick = null;

  function show(n, s = 0) {
    i = Math.max(0, Math.min(SCENES.length - 1, n)); step = s;
    const sc = SCENES[i];
    $("#dstage").innerHTML = `<section class="d-slide" data-id="${sc.id}">${sc.html()}</section>`;
    $("#dk").textContent = sc.concept;
    $("#dnotes").textContent = sc.notes;
    $("#dcount").textContent = `${i + 1} / ${SCENES.length}`;
    root.querySelectorAll("#dtrack button").forEach((b, k) => b.classList.toggle("cur", k === i));
    observe(root);
    paint();
    sc.after?.();
  }
  function paint() {
    root.querySelectorAll(".b").forEach((el) => el.classList.toggle("on", +el.dataset.s <= step));
    setTimeout(() => root.querySelectorAll(".d-bar").forEach((el) => el.classList.add("go")), 40);
  }
  function next() {
    const sc = SCENES[i];
    if (!t0 && (i > 0 || step >= 0)) startClock();
    if (step < sc.steps) { step++; paint(); } else if (i < SCENES.length - 1) show(i + 1, 0);
  }
  function prev() { if (step > 0) { step--; paint(); } else if (i > 0) show(i - 1, SCENES[i - 1].steps); }
  function startClock() { if (t0) return; t0 = Date.now(); tick = setInterval(onTick, 250); onTick(); }
  function onTick() {
    const el = (Date.now() - t0) / 1000, sc = SCENES[i];
    $("#dclock").textContent = mmss(el);
    const end = SCENES[i + 1]?.at ?? TOTAL, d = el - sc.at;
    const pace = $("#dpace");
    if (auto) pace.textContent = "auto";
    else if (el > TOTAL + 5) { pace.textContent = "over time"; pace.className = "late"; }
    else if (el > end + 8) { pace.textContent = `${Math.round(el - end)}s behind`; pace.className = "late"; }
    else if (d < -8) { pace.textContent = `${Math.round(-d)}s ahead`; pace.className = "ahead"; }
    else { pace.textContent = "on pace"; pace.className = "ok"; }
    $("#dtrack").style.setProperty("--p", Math.min(100, (el / TOTAL) * 100) + "%");
    if (auto) {                                           // follow the script: scene by scene, builds spread across each scene
      let k = 0; for (let j = 0; j < SCENES.length; j++) if (el >= SCENES[j].at) k = j;
      const s0 = SCENES[k], len = (SCENES[k + 1]?.at ?? TOTAL) - s0.at, want = Math.min(s0.steps, Math.floor(((el - s0.at) / len) * (s0.steps + 1)));
      if (k !== i) show(k, want); else if (want !== step) { step = want; paint(); }
      if (el >= TOTAL) toggleAuto(false);
    }
  }
  function toggleAuto(on = !auto) {
    auto = on; $("#dauto").textContent = auto ? "❚❚ Pause" : "▶ Auto"; $("#dauto").classList.toggle("on", auto);
    if (auto) { t0 = Date.now() - SCENES[i].at * 1000; if (!tick) tick = setInterval(onTick, 250); onTick(); }
  }
  function exit() {
    clearInterval(tick); document.removeEventListener("keydown", key, true); root.remove();
    document.documentElement.classList.remove("demo-open");
    if (document.fullscreenElement) document.exitFullscreen?.();
    onExit?.();
  }
  function key(e) {
    if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    const k = e.key; let handled = true;
    if (k === "ArrowRight" || k === " " || k === "Enter" || k === "PageDown") next();
    else if (k === "ArrowLeft" || k === "PageUp" || k === "Backspace") prev();
    else if (k === "Home") show(0); else if (k === "End") show(SCENES.length - 1, SCENES[SCENES.length - 1].steps);
    else if (k === "Escape") exit();
    else if (k === "a" || k === "A") toggleAuto();
    else if (k === "n" || k === "N") $("#dnotes").hidden = !$("#dnotes").hidden;
    else if (k === "f" || k === "F") (document.fullscreenElement ? document.exitFullscreen() : root.requestFullscreen?.());
    else if (k === "r" || k === "R") { clearInterval(tick); tick = null; t0 = null; auto = false; $("#dauto").textContent = "▶ Auto"; $("#dclock").textContent = "0:00"; $("#dpace").textContent = ""; show(0); }
    else handled = false;
    if (handled) { e.preventDefault(); e.stopPropagation(); }
  }
  document.addEventListener("keydown", key, true);
  root.addEventListener("click", (e) => {
    const b = e.target.closest("[data-d]");
    if (b) { const a = b.dataset.d; if (a === "exit") exit(); else if (a === "next") next(); else if (a === "prev") prev(); else if (a === "auto") toggleAuto(); else if (a === "notes") $("#dnotes").hidden = !$("#dnotes").hidden; else if (a === "fs") (document.fullscreenElement ? document.exitFullscreen() : root.requestFullscreen?.()); else if (a === "live") { exit(); onLive?.(); } else if (a === "guided") { exit(); onGuided?.(); } else if (a === "go") { const n = +b.dataset.i; show(n, 0); if (auto || t0) { t0 = Date.now() - SCENES[n].at * 1000; } } e.stopPropagation(); return; }
    if (e.target.closest(".d-slide")) { const r = root.getBoundingClientRect(); (e.clientX < r.left + r.width * 0.25 ? prev : next)(); }
  });
  show(0);
}
