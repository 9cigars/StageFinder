// Presentation mode: full-screen slides synced to the 4-minute spoken script.
// Keys: → / Space / Enter next build or slide · ← back · A auto-play on the script's timing · N speaker notes · F full screen · Esc exit
import { stageBoard, stageFromData, dataScores, latest } from "./engine.js";
import { diagnose } from "./diagnose.js";
import { plcChart } from "./charts.js";
import { applyTheme } from "./themes.js";
import { observe } from "./fx.js";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const TOTAL = 240;                                   // seconds: the script is 4:00
const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.max(0, Math.floor(s % 60))).padStart(2, "0")}`;

export function startDemo({ data, pb, nick, onExit }) {
  const ID = "sirmaur", I = data.iims[ID], S = I.series;
  applyTheme(ID);
  const st = stageFromData(data, ID), ds = dataScores(data, ID), dg = diagnose(data, ID);
  const pilot = data.pilot, age = 2026 - I.founded;
  const ratio5 = st.level * Math.pow((1 + st.cagr) / (1 + st.abcCagr), 5);
  const spf0 = S.studentsPerFaculty?.["2022"], spfNow = latest(S.studentsPerFaculty)?.value;
  const fac0 = S.faculty?.["2022"], facNow = latest(S.faculty)?.value;
  const feePct = Math.round((ds.roi.fee / (["ahmedabad", "bangalore", "calcutta"].reduce((a, k) => a + data.iims[k].fee.lakh, 0) / 3)) * 100);
  const P = (x, d = 0) => (x * 100).toFixed(d) + "%";
  const spfB = ["ahmedabad", "bangalore", "calcutta"].reduce((a, k) => a + (latest(data.iims[k].series.studentsPerFaculty)?.value ?? 0), 0) / 3;
  const bar = (label, val, w, cls = "") => `<div class="d-row ${cls}"><span>${label}</span><div class="d-bar"><i style="--w:${w}%"></i></div><b>${val}</b></div>`;

  const SCENES = [
    { id: "intro", at: 0, label: "Intro", concept: "Operations Management · Project 2", steps: 1,
      notes: "Sir, our project is the life-cycle analysis of IIM Sirmaur, benchmarked against IIM Ahmedabad. We built a working website called StageFinder that applies our operations concepts to real data. It covers eight IIMs, and I'll walk through the concepts in the order we used them.",
      html: () => `<div class="d-title"><h1>Stage<em>Finder</em></h1><p class="d-sub">Product life-cycle analysis of <b>IIM Sirmaur</b><br>Benchmark: IIM Ahmedabad, Bangalore and Calcutta</p>
        <div class="d-chips b" data-s="1"><span>8 IIMs</span><span>5 metrics</span><span>10 questions</span><span>NIRF data 2021–2025</span></div></div>` },
    { id: "plc", at: 30, label: "Life cycle", concept: "Concept 1 · Product life cycle", steps: 4,
      notes: "We treated an institute as a service product, with four stages: introduction, growth, maturity and decline. The stage is decided by one rule: salary compared with the IIM Ahmedabad, Bangalore and Calcutta average. Below 70% is growth, 85% or more is maturity, and a real fall is decline. Sirmaur is 11 years old, sits at 42% of that benchmark, and its pay grows 9.2% a year against 5.8%. So it is in growth, and catching up. We also removed Trichy, because its flat median was a bigger class, not decline. That shows the rule is applied with discipline.",
      html: () => { const board = stageBoard(data).map((b) => ({ id: b.id, label: b.id === ID ? "Sirmaur · you are here" : nick(b.id), t: b.t, primary: b.id === ID, tip: `${esc(data.iims[b.id].name)}: ${b.stage}` }));
        return `<h2 class="d-h">An institute is a <em>service product</em> with a life cycle</h2>
        <div class="d-split"><div class="d-card d-chart">${plcChart(board)}</div>
        <div class="d-col">
          <div class="d-stat b" data-s="2"><b>${age}</b><span>years old · founded ${I.founded}</span></div>
          <div class="d-stat b" data-s="2"><b>${P(st.level)}</b><span>of the A/B/C salary level</span></div>
          <div class="d-stat b" data-s="3"><b>${P(st.cagr, 1)}<small>vs ${P(st.abcCagr, 1)}</small></b><span>pay growth a year: Sirmaur vs A/B/C</span></div>
          <div class="d-verdict b" data-s="3">Stage: <b>${esc(st.stage)}</b>, ${esc(st.momentum)}</div></div></div>
        <div class="d-rule b" data-s="1"><span><b>&lt; 70%</b> Growth</span><span><b>70–85%</b> Late growth / early maturity</span><span><b>≥ 85%</b> Maturity</span><span><b>fall &gt; 3%</b> Decline, unless a bigger class explains it</span></div>
        <p class="d-note b" data-s="4">Trichy was removed: its median stayed flat while its class grew 48%, which is dilution, not decline.</p>`; } },
    { id: "bench", at: 75, label: "Benchmark", concept: "Concepts 2 and 3 · Benchmarking and gap analysis", steps: 4,
      notes: "We benchmarked on five metrics: salary, fee payback, faculty quality, research and diversity. The biggest gap is payback: 17.7 months against 9.6. Sirmaur's fee is 78% of the benchmark but its pay is 42%, so the problem is pay, not price. We also projected the trend. At today's rates it would take about 28 years to catch up, and only reach about 49% by 2030. That is why it needs a strategy, not patience.",
      html: () => `<h2 class="d-h">Where Sirmaur sits against the <em>IIM A/B/C benchmark</em></h2>
        <div class="d-split"><div class="d-card">${bar("Salary", `₹${ds.salary.own} L vs ₹${ds.salary.bench.toFixed(1)} L`, ds.salary.score)}${bar("ROI", `${ds.roi.own.toFixed(1)} vs ${ds.roi.bench.toFixed(1)} months`, ds.roi.score)}
          ${bar("Faculty Ph.D.", `${P(ds.faculty.own, 1)} vs ${P(ds.faculty.bench, 1)}`, ds.faculty.score)}${bar("Research", `${ds.research.own.toFixed(2)} vs ${ds.research.bench.toFixed(2)} articles per faculty`, ds.research.score)}
          ${bar("Diversity", `${P(ds.diversity.own, 1)} women · ${P(ds.diversity.intl, 1)} international`, ds.diversity.score)}<p class="d-foot b" data-s="1">Score 0–100 against the benchmark. Salary and payback are the widest gaps.</p></div>
        <div class="d-col">
          <div class="d-stat hot b" data-s="2"><b>${ds.roi.own.toFixed(1)} <small>vs ${ds.roi.bench.toFixed(1)}</small></b><span>months to recover the fee</span></div>
          <div class="d-stat b" data-s="3"><b>${feePct}% <small>fee</small> · ${P(st.level)} <small>pay</small></b><span>of the benchmark: the gap is pay, not price</span></div>
          <div class="d-stat b" data-s="4"><b>${Math.round(st.yearsToParity)} years</b><span>to match A/B/C at today's pace; only ${P(ratio5)} by 2030</span></div></div></div>` },
    { id: "voc", at: 120, label: "Students", concept: "Concept 4 · Service quality and voice of the customer", steps: 3,
      notes: "Students are the customers, so we collected their voice. Our survey of 42 students found placements, infrastructure and international exposure rated lowest. The website adds a 10-question quiz: five questions read the stage from what students see, and five find the bottleneck on each metric. We compare perception with data, and blend them 60–40, so we can see where students and numbers disagree.",
      html: () => { const weak = pilot.items.slice(0, 5), best = pilot.items[pilot.items.length - 1];
        return `<h2 class="d-h">Students are the customers: <em>their voice</em> is data</h2>
        <div class="d-split"><div class="d-card"><h3 class="d-h3">Pilot survey · ${pilot.n} Sirmaur students <small>(1 = very poor, 5 = excellent)</small></h3>
          ${weak.map((it) => bar(esc(it.item), it.mean.toFixed(1), (it.mean / 5) * 100, "wk")).join("")}
          <p class="d-foot b" data-s="1">Best rated: ${esc(best.item)} (${best.mean.toFixed(1)}). Likelihood to recommend: ${pilot.recommend.mean} on the form's 0–10 scale.</p></div>
        <div class="d-col"><div class="d-flow b" data-s="2"><div><b>Part A</b><span>5 questions read the stage from what students see</span></div><div><b>Part B</b><span>5 questions find the bottleneck, one per metric</span></div></div>
          <div class="d-stat b" data-s="3"><b>60 / 40</b><span>data and student rating blended; gaps between them are shown</span></div></div></div>`; } },
    { id: "cap", at: 160, label: "Capacity", concept: "Concepts 5 and 6 · Capacity planning and bottlenecks", steps: 4,
      notes: "Capacity shows up in faculty. Sirmaur has 10.7 students per faculty against 9.7, and the ratio has roughly doubled since 2022 because the class grew faster than the faculty. We ranked every problem by severity, so the biggest constraint is fixed first, which is the bottleneck idea.",
      html: () => `<h2 class="d-h">Capacity is the faculty: <em>fix the biggest constraint first</em></h2>
        <div class="d-split"><div class="d-col"><div class="d-stat b" data-s="1"><b>${spfNow.toFixed(1)} <small>vs ${spfB.toFixed(1)}</small></b><span>students per faculty: Sirmaur vs A/B/C</span></div>
          <div class="d-stat b" data-s="2"><b>${spf0 ? spf0.toFixed(1) : "5.3"} → ${spfNow.toFixed(1)}</b><span>students per faculty, 2022 to 2026${fac0 ? `; listed faculty ${fac0} → ${facNow}` : ""}. NIRF counting rules vary.</span></div></div>
        <div class="d-card b" data-s="3"><h3 class="d-h3">Problems ranked by severity</h3>${dg.problems.slice(0, 5).map((p) => bar(esc(p.title), p.severity, p.severity, "pr")).join("")}
          <p class="d-foot b" data-s="4">Highest severity first: the bottleneck idea. Playbooks attach to each problem.</p></div></div>` },
    { id: "strat", at: 195, label: "Strategy", concept: "Concepts 7 and 8 · Strategic operations and continuous improvement", steps: 3,
      notes: "For the solutions, we studied how leading schools solved the same problems at the same age. ISB and CEIBS earned their first international accreditation at about age 10, and Sirmaur's peers Shillong, Ranchi and Sambalpur are doing it now. That gives a five-year roadmap with measurable indicators: salary ratio, payback, research per faculty, students per faculty and accreditation. Accreditation itself is a continuous improvement cycle, and the site repeats it: measure, diagnose, act, measure again.",
      html: () => { const tl = [["CEIBS", 10, "EQUIS, 2004"], ["ISB", 10, "AACSB, 2011"], ["Sambalpur", 10, "AACSB under way"], ["IIM Kozhikode", 14, "AMBA, 2010"], ["Ranchi", 17, "AMBA, 2026"], ["Shillong", 19, "AACSB + EQUIS, 2026"], ["IIM Indore", 23, "Triple crown, 2019"]];
        return `<h2 class="d-h">Leaders sought <em>international accreditation</em> at about age 10</h2>
        <div class="d-tl">${tl.map(([n, a, w], i) => `<div class="d-tick"><b>${a}</b><span>${n}</span><small>${w}</small></div>`).join("")}<div class="d-tick me"><b>${age}</b><span>Sirmaur</span><small>none found yet</small></div></div>
        <div class="d-road b" data-s="1"><div><b>Years 1–2</b>Start AACSB or AMBA · publish the fee-aid scheme · faculty plan</div><div><b>Years 2–4</b>Research targets · visiting scholars · exchange partners · PPO route</div><div><b>Year 5</b>Apply for accreditation</div></div>
        <div class="d-kpi b" data-s="2"><b>Success indicators</b><span>Salary vs A/B/C</span><span>Payback months</span><span>Research per faculty</span><span>Students per faculty</span><span>New recruiters</span><span>International share</span><span>Accreditation</span></div>
        <div class="d-loop b" data-s="3"><span>Measure</span>→<span>Diagnose</span>→<span>Act</span>→<span>Measure again</span></div>`; } },
    { id: "close", at: 230, label: "Close", concept: "Limits and close", steps: 1,
      notes: "One honest limit: the stage rests on salary, cross-checked by student signals. Thank you, sir.",
      html: () => `<div class="d-title"><h1>Thank <em>you</em></h1><p class="d-sub">One honest limit: the stage rests on salary, cross-checked by student signals.</p>
        <div class="d-chips b" data-s="1"><span>9cigars.github.io/StageFinder</span></div></div>` },
  ];

  /* ---------------- shell ---------------- */
  const root = document.createElement("div");
  root.id = "demo"; root.className = "demo"; root.setAttribute("role", "dialog"); root.setAttribute("aria-label", "Presentation mode");
  root.innerHTML = `<div class="d-top"><span class="d-kick" id="dk"></span><div class="d-clock"><span id="dpace"></span><b id="dclock">0:00</b><small> / 4:00</small></div><button class="d-btn" data-d="exit" aria-label="Exit presentation">✕</button></div>
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
    if (b) { const a = b.dataset.d; if (a === "exit") exit(); else if (a === "next") next(); else if (a === "prev") prev(); else if (a === "auto") toggleAuto(); else if (a === "notes") $("#dnotes").hidden = !$("#dnotes").hidden; else if (a === "fs") (document.fullscreenElement ? document.exitFullscreen() : root.requestFullscreen?.()); else if (a === "go") { const n = +b.dataset.i; show(n, 0); if (auto || t0) { t0 = Date.now() - SCENES[n].at * 1000; } } e.stopPropagation(); return; }
    if (e.target.closest(".d-slide")) { const r = root.getBoundingClientRect(); (e.clientX < r.left + r.width * 0.25 ? prev : next)(); }
  });
  show(0);
}
