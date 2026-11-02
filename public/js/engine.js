// Scoring and life-cycle engine. Pure functions: no DOM, runs in the browser and in Node.
// Every number comes from public/data/iims.json (your workbooks). Nothing is estimated.
import { METRICS, STAGE_NAME, STAGE_ORDER, STAGE_POS } from "./questions.js";

export const ABC = ["ahmedabad", "bangalore", "calcutta"];
export const THRESHOLDS = { growthBelow: 0.70, maturityFrom: 0.85, declineDrop: -0.03, stallCagr: 0.025, bottleneckBelow: 65 };
export const BLEND = { data: 0.6, student: 0.4 };

const clamp = (x, a = 0, b = 100) => Math.min(b, Math.max(a, x));
const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
const yearsOf = (s) => Object.keys(s || {}).map(Number).filter((y) => s[y] != null).sort((a, b) => a - b);

export function latest(s) {
  const y = yearsOf(s);
  if (!y.length) return null;
  const Y = y[y.length - 1];
  return { year: Y, value: s[Y] };
}
const nearest = (s, year, back = 1) => {
  for (let d = 0; d <= back; d++) if (s?.[year - d] != null) return s[year - d];
  return null;
};
function benchAt(data, key, year, min = 2) {
  const v = ABC.map((id) => nearest(data.iims[id].series[key], year)).filter((x) => x != null);
  return v.length >= min ? { value: mean(v), n: v.length } : null;
}
function benchLatest(data, key, min = 1) {
  const v = ABC.map((id) => latest(data.iims[id].series[key])?.value).filter((x) => x != null);
  return v.length >= min ? { value: mean(v), n: v.length } : null;
}
function cagr(s, minGap = 2) {
  const y = yearsOf(s);
  if (y.length < 2) return null;
  const gap = y[y.length - 1] - y[0];
  if (gap < minGap || s[y[0]] <= 0) return null;
  return Math.pow(s[y[y.length - 1]] / s[y[0]], 1 / gap) - 1;
}
// growth over the last ~3 years (falls back to 2)
function recent(s) {
  const l = latest(s);
  if (!l) return null;
  for (const back of [3, 2]) {
    const v = s[l.year - back];
    if (v != null && v > 0) return { cagr: Math.pow(l.value / v, 1 / back) - 1, change: l.value / v - 1, from: l.year - back, to: l.year };
  }
  return null;
}

/* ------------------------------------------------------------------ data side */
export function dataScores(data, id) {
  const S = data.iims[id].series;
  const out = {};
  const none = (why) => ({ score: null, why });

  // 1. salary
  const sal = latest(S.salary);
  if (sal) {
    const b = benchAt(data, "salary", sal.year);
    out.salary = b ? {
      score: clamp((sal.value / b.value) * 100), own: sal.value, year: sal.year, bench: b.value,
      ratio: sal.value / b.value, unit: "₹ lakh", benchN: b.n,
    } : none("No benchmark for that year");
  } else out.salary = none("No median salary found");

  // 2. ROI: current programme fee / latest median salary (gross months); lower is better
  const pbOf = (iim) => { const sl = latest(iim.series.salary); return iim.fee && sl ? { months: (iim.fee.lakh / sl.value) * 12, fee: iim.fee.lakh, year: sl.year } : null; };
  const pb = pbOf(data.iims[id]);
  const pbB = ABC.map((k) => pbOf(data.iims[k])).filter(Boolean);
  out.roi = pb && pbB.length >= 2 ? {
    score: clamp((mean(pbB.map((x) => x.months)) / pb.months) * 100), own: pb.months, year: pb.year, fee: pb.fee, feeBatch: data.iims[id].fee.batch,
    bench: mean(pbB.map((x) => x.months)), unit: "months", benchN: pbB.length,
  } : none("Fee data not found for this IIM");

  // 3. faculty with PhDs
  const ph = latest(S.phd), phB = benchLatest(data, "phd", 2);
  out.faculty = ph && phB ? {
    score: clamp((ph.value / phB.value) * 100), own: ph.value, year: ph.year, bench: phB.value, unit: "%", benchN: phB.n,
  } : none("No PhD share found");

  // 4. research: journal articles per faculty (2023-25 average of OpenAlex articles / latest NIRF faculty count)
  const rsOf = (iim) => {
    const a = ["2023", "2024", "2025"].map((y) => iim.series.articles?.[y]).filter((v) => v != null), f = latest(iim.series.faculty);
    return a.length && f ? { v: mean(a) / f.value, art: mean(a), fac: f.value } : null;
  };
  const rs = rsOf(data.iims[id]);
  const rsB = ABC.map((k) => rsOf(data.iims[k])).filter(Boolean);
  out.research = rs && rsB.length >= 2 ? {
    score: clamp((rs.v / mean(rsB.map((x) => x.v))) * 100), own: rs.v, year: 2025, bench: mean(rsB.map((x) => x.v)), unit: "articles / faculty", benchN: rsB.length, art: rs.art, fac: rs.fac,
  } : none("No journal-article count found");

  // 5. diversity: 70% women share, 30% international share
  const wm = latest(S.women), it = latest(S.intl);
  if (wm) {
    const wB = benchAt(data, "women", wm.year) || benchLatest(data, "women", 2);
    const iB = benchLatest(data, "intl", 2);
    const wScore = clamp((wm.value / wB.value) * 100);
    const iBench = Math.max(iB ? iB.value : 0, 0.005);
    const iScore = it ? clamp((it.value / iBench) * 100) : null;
    out.diversity = {
      score: iScore == null ? wScore : 0.7 * wScore + 0.3 * iScore,
      own: wm.value, year: wm.year, bench: wB.value, unit: "% women", benchN: wB.n,
      intl: it ? it.value : null, intlBench: iBench,
    };
  } else out.diversity = none("No women-share data found");
  return out;
}

/* ------------------------------------------------------------------ stage */
export function stageFromData(data, id) {
  const s = data.iims[id].series.salary;
  const sal = latest(s);
  if (!sal) return null;
  const b = benchAt(data, "salary", sal.year);
  const L = sal.value / b.value;
  const own = cagr(s);
  const abc = mean(ABC.map((a) => cagr(data.iims[a].series.salary)).filter((x) => x != null));
  const rec = recent(s);
  const abcRec = mean(ABC.map((a) => recent(data.iims[a].series.salary)?.cagr).filter((x) => x != null));
  const T = THRESHOLDS;
  const pct = (x) => (x * 100).toFixed(1) + "%";
  const ev = [];
  ev.push(`Median salary ₹${sal.value} L (${sal.year}) is ${(L * 100).toFixed(0)}% of the IIM A/B/C average of ₹${b.value.toFixed(1)} L.`);
  if (own != null) ev.push(`Salary grew ${pct(own)} a year over ${yearsOf(s)[0]}–${sal.year}, against ${pct(abc)} for IIM A/B/C.`);
  if (rec) ev.push(`Over ${rec.from}–${rec.to} it moved ${rec.change >= 0 ? "+" : ""}${(rec.change * 100).toFixed(1)}% in total.`);

  let stage, momentum, rule;
  // a falling median on a much bigger class or more recruiters is dilution from expansion, not decline
  const grew = (key) => { const a = data.iims[id].series[key], l = latest(a); const v = rec && a ? a[rec.from] : null; return !!(l && v != null && l.value > v * 1.05); };
  const dilution = grew("placed") || grew("firms");
  if (rec && rec.change <= T.declineDrop && !dilution) {
    stage = "Decline"; momentum = "falling";
    rule = `Median salary fell ${(Math.abs(rec.change) * 100).toFixed(1)}% between ${rec.from} and ${rec.to}; a fall of more than 3% marks decline.`;
  } else if (L >= T.maturityFrom) {
    stage = "Maturity"; momentum = own != null && own > abc + 0.01 ? "still climbing" : "steady";
    rule = `Salary is at ${(L * 100).toFixed(0)}% of the A/B/C level, above the ${T.maturityFrom * 100}% line for maturity.`;
  } else if (L >= T.growthBelow) {
    const slow = rec && rec.cagr < (abcRec ?? abc);
    stage = slow ? "Maturity" : "Growth";
    momentum = slow ? "plateauing" : "catching up";
    rule = `Salary is at ${(L * 100).toFixed(0)}% of the A/B/C level (between 70% and 85%). ` +
      (slow ? `Recent growth (${pct(rec.cagr)} a year) is below the benchmark's, so it is read as early maturity.`
            : `Recent growth is at or above the benchmark's, so it is still in late growth.`);
  } else {
    stage = "Growth";
    const stalling = (rec && rec.cagr < T.stallCagr) || (own != null && own < abc);
    momentum = stalling ? "stalling" : "catching up";
    rule = `Salary is at ${(L * 100).toFixed(0)}% of the A/B/C level, below the 70% line, so the institute is still building. ` +
      (stalling ? "But growth is not outpacing the benchmark, so the climb is stalling." : "Growth is faster than the benchmark's, so it is closing the gap.");
  }
  // position on the S-curve (0..1)
  let t;
  if (stage === "Decline") t = 0.9;
  else if (L < 0.7) t = 0.2 + (Math.max(L, 0) / 0.7) * 0.38;
  else t = 0.58 + (Math.min(L, 1) - 0.7) / 0.3 * 0.24;
  const yearsToParity = own != null && abc != null && own > abc && L < T.maturityFrom
    ? Math.log(1 / L) / (Math.log(1 + own) - Math.log(1 + abc)) : null;
  return { stage, momentum, t, level: L, cagr: own, abcCagr: abc, recent: rec, rule, evidence: ev, year: sal.year, yearsToParity };
}

// Part A answers vote for a stage. votes = { intro, growth, mature, decline } counts.
export function votesFrom(stageAnswers = {}) {
  const v = { intro: 0, growth: 0, mature: 0, decline: 0 };
  for (const x of Object.values(stageAnswers)) if (x in v) v[x]++;
  return v;
}
export function stageFromVotes(votes, prefer) {
  const total = Object.values(votes).reduce((a, b) => a + b, 0);
  if (!total) return null;
  const top = Math.max(...Object.values(votes));
  const tied = STAGE_ORDER.filter((k) => votes[k] === top);
  const code = tied.length > 1 && prefer && tied.includes(prefer) ? prefer : tied[0];
  const dir = { intro: "too early to tell", growth: "rising", mature: "settled", decline: "falling" };
  return { stage: STAGE_NAME[code], code, votes, total, share: top / total, momentum: dir[code], tied: tied.length > 1 };
}
// where the students' votes put the institute on the life-cycle curve (0..1), for the live marker
export function votePosition(votes) {
  const total = Object.values(votes).reduce((a, b) => a + b, 0);
  if (!total) return null;
  return STAGE_ORDER.reduce((s, k) => s + STAGE_POS[k] * votes[k], 0) / total;
}

export function stageBoard(data) {
  return Object.keys(data.iims).map((id) => ({ id, ...stageFromData(data, id) }));
}

/* ------------------------------------------------------------------ student + combined */
const toScore = (r) => (r == null ? null : ((r - 1) / 4) * 100);

export function analyse(data, id, answers) {
  const iim = data.iims[id];
  const ds = dataScores(data, id);
  const st = stageFromData(data, id);
  const rates = answers?.ratings || {};
  const metrics = METRICS.map((m) => {
    const D = ds[m.id].score, S = toScore(rates[m.id]);
    let C, basis;
    if (D != null && S != null) { C = BLEND.data * D + BLEND.student * S; basis = "both"; }
    else if (D != null) { C = D; basis = "data"; }
    else if (S != null) { C = S; basis = "students"; }
    else { C = null; basis = "none"; }
    const gap = D != null && S != null ? S - D : null;
    const tag = C == null ? "unknown" : C >= 70 ? "strength" : C < 50 ? "weakness" : "middle";
    return { ...m, data: ds[m.id], student: S, rating: rates[m.id] ?? null, composite: C, basis, gap, tag };
  });
  const ranked = metrics.filter((m) => m.composite != null).sort((a, b) => a.composite - b.composite);
  // Bottlenecks must be backed by public data. Weak spots that only students raised are listed apart as "concerns".
  const bottlenecks = ranked.filter((m) => m.basis !== "students" && m.composite < THRESHOLDS.bottleneckBelow).slice(0, 2).map((m) => ({ ...m, severity: 100 - m.composite }));
  const concerns = ranked.filter((m) => m.basis === "students" && m.composite < 50).slice(0, 1).map((m) => ({ ...m, severity: 100 - m.composite }));
  const votes = answers?.stageVotes || votesFrom(answers?.stage);
  const view = stageFromVotes(votes, st ? Object.keys(STAGE_NAME).find((k) => STAGE_NAME[k] === st.stage) : null);
  const agree = st && view ? st.stage === view.stage : null;
  return { iim, stage: st, studentView: view, agree, metrics, bottlenecks, concerns,
    strengths: ranked.filter((m) => m.tag === "strength").reverse(), weaknesses: ranked.filter((m) => m.tag === "weakness") };
}

// metrics to ask "what is the cause?" about: the two data-backed bottlenecks, plus one student-only concern
export function weakestMetrics(data, id, answers) {
  const r = analyse(data, id, answers);
  return [...r.bottlenecks, ...r.concerns].map((m) => m.id);
}

/* ------------------------------------------------------------------ community aggregate */
export function aggregateToAnswers(agg) {
  // agg from the API: { n, ratingMean, stageCounts }
  const ratings = {};
  for (const m of METRICS) ratings[m.id] = agg.ratingMean?.[m.id] ?? null;
  return { ratings, stageVotes: { intro: 0, growth: 0, mature: 0, decline: 0, ...(agg.stageCounts || {}) } };
}

/* ------------------------------------------------------------------ formatting */
export const fmt = {
  lpa: (v) => `₹${(+v).toFixed(v >= 100 ? 0 : 2).replace(/\.?0+$/, "")} L`,
  pct: (v, d = 1) => `${(v * 100).toFixed(d)}%`,
  num: (v, d = 2) => (+v).toFixed(d).replace(/\.?0+$/, ""),
};
