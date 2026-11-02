// Reads an institute's own numbers against the IIM A/B/C benchmark and the other IIMs, and returns ranked problems.
// Each problem names the playbooks (public/data/playbooks.json) that show how leaders fixed the same problem.
import { ABC, latest, dataScores, stageFromData } from "./engine.js";

const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
const sd = (a) => { const m = mean(a); return Math.sqrt(mean(a.map((x) => (x - m) ** 2))); };
const median = (a) => { const s = [...a].sort((x, y) => x - y), n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };
const P = (x, d = 0) => (x * 100).toFixed(d) + "%";
const r1 = (x) => (Math.round(x * 10) / 10).toString();

export function diagnose(data, id) {
  const I = data.iims[id], S = I.series, ids = Object.keys(data.iims);
  const st = stageFromData(data, id), ds = dataScores(data, id);
  const L = (k, iim = I) => latest(iim.series[k])?.value ?? null;
  const abc = (fn) => { const v = ABC.map((k) => fn(data.iims[k])).filter((x) => x != null); return v.length ? mean(v) : null; };
  const out = [], notes = [];
  const add = (key, severity, evidence) => out.push({ id: key, title: data.playbooksMeta?.[key]?.title, severity: Math.min(100, Math.max(1, Math.round(severity))), evidence });

  // pay level
  const sal = ds.salary;
  if (sal.score != null && sal.ratio < 0.85) {
    const ev = [`Median ₹${sal.own} L (${sal.year}) is ${P(sal.ratio)} of the IIM A/B/C average (₹${r1(sal.bench)} L).`];
    if (st?.yearsToParity) ev.push(`Growing ${P(st.cagr, 1)} a year against ${P(st.abcCagr, 1)}, it would reach the A/B/C level in about ${Math.round(st.yearsToParity)} years.`);
    add("pay", (1 - sal.ratio) * 100, ev);
  }
  // payback
  const roi = ds.roi;
  if (roi.score != null && roi.own > roi.bench * 1.15) {
    const fa = abc((i) => i.fee?.lakh), fr = fa ? roi.fee / fa : 1;
    add("roi", (roi.own / roi.bench - 1) * 55, [`Fee payback is ${r1(roi.own)} months against ${r1(roi.bench)} at IIM A/B/C.`,
      fr < 0.95 ? `The fee is ${P(fr)} of the A/B/C fee but pay is ${P(sal.ratio)}, so pay, not price, explains most of the gap.` : `The fee is ${P(fr)} of the A/B/C fee, so price and pay both contribute.`]);
  }
  // growth
  if (st?.cagr != null) {
    const eff = Math.min(st.cagr, st.recent ? st.recent.cagr : st.cagr);
    if (eff < st.abcCagr * 0.95) add("growth", ((st.abcCagr - eff) / st.abcCagr) * 100,
      [`Median pay grew ${P(st.cagr, 1)} a year since ${Object.keys(S.salary).filter((y) => S.salary[y] != null).sort()[0]}${st.recent ? `, but ${P(st.recent.cagr, 1)} a year over ${st.recent.from}-${st.recent.to}` : ""}, against ${P(st.abcCagr, 1)} at IIM A/B/C.`]);
  }
  // recruiters
  const fi = L("firms"), fb = abc((i) => L("firms", i)), fy = latest(S.firms)?.year;
  const fv = Object.entries(S.firms || {}).filter(([, v]) => v != null).sort();
  if (fi != null && fb != null) {
    const fall = fv.length > 1 ? 1 - fv[fv.length - 1][1] / Math.max(...fv.map(([, v]) => v)) : 0;
    if (fi < fb * 0.9 || fall > 0.25) add("recruiters", Math.max((1 - fi / fb) * 100, fall * 100),
      [`${fi} recruiters in ${fy}, against ${Math.round(fb)} on average at IIM A/B/C${fall > 0.25 ? ` (down from ${Math.max(...fv.map(([, v]) => v))} at its peak)` : ""}.`]);
  }
  // research
  const rs = ds.research;
  if (rs.score != null && rs.own < rs.bench * 0.85) add("research", (1 - rs.own / rs.bench) * 100,
    [`${rs.own.toFixed(2)} journal articles per faculty (about ${Math.round(rs.art)} a year across ${rs.fac} faculty), against ${rs.bench.toFixed(2)} at IIM A/B/C (OpenAlex, 2023-25).`]);
  // faculty capacity and depth
  {
    const spf = L("studentsPerFaculty"), sb = abc((i) => L("studentsPerFaculty", i)), ph = L("phd"), pb = abc((i) => L("phd", i));
    const f22 = S.faculty?.["2022"], fl = latest(S.faculty), ev = []; let sev = 0;
    if (spf != null && sb != null && spf > sb * 1.1) { ev.push(`${r1(spf)} students per listed faculty member, against ${r1(sb)} at IIM A/B/C.`); sev = Math.max(sev, (spf / sb - 1) * 200); }
    if (ph != null && pb != null && ph < pb - 0.06) { ev.push(`${P(ph, 1)} of listed faculty hold a Ph.D., against ${P(pb, 1)} at IIM A/B/C.`); sev = Math.max(sev, (pb - ph) * 400); }
    if (f22 != null && fl && fl.year > 2022 && fl.value < f22 * 0.9) { ev.push(`Listed faculty went from ${f22} (2022) to ${fl.value} (${fl.year}) while the class grew. NIRF counting rules vary between editions, so treat this as indicative.`); sev = Math.max(sev, (1 - fl.value / f22) * 200); }
    if (ev.length) add("faculty", sev, ev);
  }
  // international students
  const it = L("intl");
  if (it != null && it < 0.005) add("intl", 30, [`International students are ${P(it, 2)} of PG students; the IIM A/B/C average is ${P(abc((i) => L("intl", i)) || 0, 2)} and no IIM in the dataset is above ${P(Math.max(...ids.map((k) => L("intl", data.iims[k]) ?? 0)), 1)}.`]);
  // women's share, against the median of the eight
  const w = L("women"), wm = median(ids.map((k) => L("women", data.iims[k])).filter((v) => v != null));
  if (w != null && w < wm * 0.9) add("women", (1 - w / wm) * 100,
    [`Women are ${P(w, 1)} of PG students; the median across these IIMs is ${P(wm, 1)}, and the newer IIMs Shillong, Jammu and Sambalpur are at 48-68%.`]);

  // data reliability notes
  const ys = Object.entries(S.salary).filter(([, v]) => v != null).sort();
  const yoy = ys.slice(1).map(([, v], i) => v / ys[i][1] - 1);
  if (yoy.length > 2 && sd(yoy) > 0.15) notes.push(`Median pay swings ±${P(sd(yoy), 0)} a year, so one year's figure can mislead; read trends, not single years.`);
  if (id === "sirmaur") notes.push("The 2026 placement report is not out, so 2025 is the latest verified year. Listed faculty counts changed with NIRF's counting rules (62, 66, 34, 52, 55, 56).");

  const meta = data.playbooksMeta || {};
  out.forEach((p) => { p.title = meta[p.id]?.title || p.id; p.playbooks = meta[p.id]?.playbooks || []; });
  return { problems: out.sort((a, b) => b.severity - a.severity), notes, age: 2026 - I.founded, stage: st?.stage };
}
