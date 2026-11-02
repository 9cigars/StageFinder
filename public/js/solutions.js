// Matches documented cases to a named cause, and checks the cause against the institute's own data.
import { ABC, latest, dataScores, stageFromData } from "./engine.js";

const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
const EV = { official: 0, report: 1, dataset: 2, news: 3, secondary: 4 };
const KD = { action: 0, outcome: 1, reference: 2 };

// cases for a cause: best detail match first, then peers of the same kind, then strongest evidence
export function casesFor(sol, causeId, detail, iimId, data) {
  const isBench = data.iims[iimId]?.benchmark;
  return sol.cases
    .filter((c) => c.causes.includes(causeId))
    .map((c) => {
      const own = c.who.includes(data.iims[iimId].name);
      return { ...c, own, who: c.who.replace(/ \(own (history|policy)\)/, "") };
    })
    .sort((a, b) => {
      const d = (x) => (detail && x.forDetail?.includes(detail) ? 0 : 1);
      const p = (x) => (x.peer === "both" || x.peer === (isBench ? "benchmark" : "new") ? 0 : 1);
      return d(a) - d(b) || p(a) - p(b) || EV[a.evidence] - EV[b.evidence] || KD[a.kind] - KD[b.kind];
    });
}

// does the institute's own data back up what the student named?  -> { v: 'supports' | 'contradicts', t } or null
export function causeCheck(data, id, cid) {
  const I = data.iims[id], S = I.series;
  const L = (k, iim = I) => latest(iim.series[k])?.value ?? null;
  const abc = (fn) => { const v = ABC.map((k) => fn(data.iims[k])).filter((x) => x != null); return v.length ? mean(v) : null; };
  const P = (x, d = 0) => (x * 100).toFixed(d) + "%";
  const r1 = (x) => (Math.round(x * 10) / 10).toString();
  const ds = dataScores(data, id);
  switch (cid) {
    case "s1": case "s5": {
      const own = L("firms"), b = abc((i) => L("firms", i)), y = latest(S.firms)?.year;
      if (own == null || b == null) return null;
      const line = `${I.name} had ${own} recruiters in ${y}, against ${Math.round(b)} on average at IIM A/B/C.`;
      if (own < b * 0.9) return { v: "supports", t: line };
      return cid === "s5"
        ? { v: "contradicts", t: `${line} Location has not kept recruiters away.` }
        : { v: "partial", t: `${line} The number of recruiters is not low. Whether one particular sector is missing is not in public data, so that part rests on student experience.` };
    }
    case "s3": {
      const yrs = Object.keys(S.salaryMean || {}).filter((y) => S.salaryMean[y] != null && S.salary[y] != null).sort();
      if (!yrs.length) return null;
      const y = yrs[yrs.length - 1], r = S.salaryMean[y] / S.salary[y];
      return r >= 1.12
        ? { v: "supports", t: `In ${y} the average (₹${S.salaryMean[y]} L) was ${P(r - 1)} above the median (₹${S.salary[y]} L), which points to a few large offers.` }
        : { v: "contradicts", t: `In ${y} the average (₹${S.salaryMean[y]} L) was ${r < 1 ? "below" : "only " + P(r - 1) + " above"} the median (₹${S.salary[y]} L), so the median is not being held down by a few large offers.` };
    }
    case "s6": {
      const s = ds.salary; if (s.score == null) return null;
      return s.ratio < 0.85
        ? { v: "supports", t: `The ${s.year} median (₹${s.own} L) is ${P(s.ratio)} of the IIM A/B/C average (₹${r1(s.bench)} L). This compares medians across all roles, not pay for the same role.` }
        : { v: "contradicts", t: `The ${s.year} median (₹${s.own} L) is ${P(s.ratio)} of the IIM A/B/C average, so there is no pay gap at the median.` };
    }
    case "r1": {
      const r = ds.roi; if (r.score == null) return null;
      const fa = abc((i) => i.fee?.lakh), fr = fa ? r.fee / fa : null;
      if (r.own > r.bench * 1.15)
        return { v: "supports", t: `Payback is ${r1(r.own)} months against ${r1(r.bench)} at IIM A/B/C.` + (fr && fr < 0.95 ? ` The fee itself is ${P(fr)} of the A/B/C fee, so the gap comes mainly from pay, not price.` : "") };
      return { v: "contradicts", t: `Payback is ${r1(r.own)} months, close to the ${r1(r.bench)} at IIM A/B/C.` };
    }
    case "r4": {
      const st = stageFromData(data, id); if (!st || st.cagr == null) return null;
      return st.cagr >= st.abcCagr
        ? { v: "contradicts", t: `Median pay grew ${P(st.cagr, 1)} a year, against ${P(st.abcCagr, 1)} at IIM A/B/C. Growth is not slow; the starting level is lower.` }
        : { v: "supports", t: `Median pay grew ${P(st.cagr, 1)} a year, against ${P(st.abcCagr, 1)} at IIM A/B/C.` };
    }
    case "f6": {
      const own = L("studentsPerFaculty"), b = abc((i) => L("studentsPerFaculty", i)); if (own == null || b == null) return null;
      return own > b * 1.15
        ? { v: "supports", t: `${r1(own)} students per listed faculty member, against ${r1(b)} on average at IIM A/B/C.` }
        : { v: "contradicts", t: `${r1(own)} students per listed faculty member, against ${r1(b)} on average at IIM A/B/C: class load per faculty is not higher.` };
    }
    case "f3": {
      const f24 = S.faculty?.["2024"], fl = latest(S.faculty); if (f24 == null || !fl || fl.year <= 2024) return null;
      const ch = fl.value / f24 - 1;
      return ch <= -0.1
        ? { v: "supports", t: `Faculty listed in NIRF fell from ${f24} (2024) to ${fl.value} (${fl.year}). Counting rules differ between editions, so treat this as indicative.` }
        : { v: "contradicts", t: `Faculty listed in NIRF went from ${f24} (2024) to ${fl.value} (${fl.year}), so there is no sign of a shrinking faculty. Counting rules differ between editions.` };
    }
    case "x1": case "x4": {
      const r = ds.research; if (r.score == null) return null;
      return r.own < r.bench * 0.85
        ? { v: "supports", t: `${r.own.toFixed(2)} journal articles per faculty against ${r.bench.toFixed(2)} at IIM A/B/C (OpenAlex, 2023-25 average).` }
        : { v: "contradicts", t: `${r.own.toFixed(2)} journal articles per faculty against ${r.bench.toFixed(2)} at IIM A/B/C (OpenAlex, 2023-25 average): output per faculty is not low.` };
    }
    case "d1": {
      const w = ds.diversity; if (w.score == null) return null;
      return w.own < w.bench * 0.9
        ? { v: "supports", t: `Women are ${P(w.own, 1)} of PG students (${w.year}), against ${P(w.bench, 1)} at IIM A/B/C.` }
        : { v: "contradicts", t: `Women are ${P(w.own, 1)} of PG students (${w.year}), against ${P(w.bench, 1)} at IIM A/B/C, so the share is not below the benchmark.` };
    }
    case "d2": {
      const w = ds.diversity; if (w.intl == null) return null;
      return w.intl < 0.005
        ? { v: "supports", t: `International students are ${P(w.intl, 2)} of PG students; IIM A/B/C average about ${P(abc((i) => L("intl", i)) || 0, 2)}.` }
        : { v: "contradicts", t: `International students are ${P(w.intl, 2)} of PG students.` };
    }
    default: return null;
  }
}
