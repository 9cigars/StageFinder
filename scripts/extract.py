"""Builds public/data/iims.json from the 9 IIM workbooks and the Sirmaur pilot survey.

Run:  python scripts/extract.py "<folder with IIM_*_Metrics_2021-2026.xlsx>" "<survey .xlsx>"
Only values that exist in the workbooks are copied. 'n/a' stays null; nothing is estimated.
"""
import json, re, sys, glob, os, collections, statistics
import openpyxl

SRC = sys.argv[1]
SURVEY = sys.argv[2] if len(sys.argv) > 2 else None
OUT = os.path.join(os.path.dirname(__file__), "..", "public", "data", "iims.json")
YEARS = [2021, 2022, 2023, 2024, 2025, 2026]

META = {
    "ahmedabad": dict(name="IIM Ahmedabad", short="IIMA", city="Ahmedabad", state="Gujarat", founded=1961, benchmark=True),
    "bangalore": dict(name="IIM Bangalore", short="IIMB", city="Bengaluru", state="Karnataka", founded=1973, benchmark=True),
    "calcutta": dict(name="IIM Calcutta", short="IIMC", city="Kolkata", state="West Bengal", founded=1961, benchmark=True),
    "jammu": dict(name="IIM Jammu", short="IIMJ", city="Jammu", state="Jammu & Kashmir", founded=2016, benchmark=False),
    "ranchi": dict(name="IIM Ranchi", short="IIMR", city="Ranchi", state="Jharkhand", founded=2009, benchmark=False),
    "sambalpur": dict(name="IIM Sambalpur", short="IIMS", city="Sambalpur", state="Odisha", founded=2015, benchmark=False),
    "shillong": dict(name="IIM Shillong", short="IIMSh", city="Shillong", state="Meghalaya", founded=2007, benchmark=False),
    "sirmaur": dict(name="IIM Sirmaur", short="IIMSir", city="Paonta Sahib", state="Himachal Pradesh", founded=2015, benchmark=False),
    "trichy": dict(name="IIM Tiruchirappalli", short="IIMT", city="Tiruchirappalli", state="Tamil Nadu", founded=2011, benchmark=False),
}

# label (regex on the Component / Metric column) -> series key
LABELS = [
    (r"^Median (salary|MEP)$", "salary"),
    (r"^Mean (salary|MEP)$", "salaryMean"),
    (r"^Payback, gross months$", "payback"),
    (r"^Share of listed faculty with a Ph\.D\.$", "phd"),
    (r"^Faculty (listed in NIRF|listed)$", "faculty"),
    (r"^Students per listed faculty$", "studentsPerFaculty"),
    (r"^Journal articles per (listed|working) faculty$", "articlesPerFaculty"),
    (r"^Women share of PG students$", "women"),
    (r"^International share of PG students$", "intl"),
    (r"^Firms participating$", "firms"),
    (r"^Students placed$", "placed"),
]


def num(v):
    return float(v) if isinstance(v, (int, float)) and not isinstance(v, bool) else None


def series(row):
    return {str(y): num(v) for y, v in zip(YEARS, row[3:9])}


out = {"years": YEARS, "iims": {}, "pilot": None}

for path in sorted(glob.glob(os.path.join(SRC, "IIM_*_Metrics_2021-2026.xlsx"))):
    key = os.path.basename(path).split("_")[1].lower()
    if key not in META:
        continue
    wb = openpyxl.load_workbook(path, data_only=True)
    ws = wb.worksheets[0]
    data = {}
    notes = []
    for row in ws.iter_rows(min_row=4, values_only=True):
        comp = row[2] or row[1]
        if row[1] == "Notes" or (row[1] and str(row[1]).startswith("•")):
            pass
        if isinstance(row[1], str) and row[1].startswith("•"):
            notes.append(row[1].lstrip("• ").strip())
        if not isinstance(comp, str):
            continue
        for rx, k in LABELS:
            if re.match(rx, comp.strip()) and k not in data:
                data[k] = series(row)
                break
    # Ahmedabad keeps placed counts on the Inputs sheet only
    if "placed" not in data and "Inputs" in wb.sheetnames:
        for row in wb["Inputs"].iter_rows(min_row=4, values_only=True):
            if row[0] == "placed":
                data["placed"] = series(row)
    flags = []
    if "Sources & Notes" in wb.sheetnames:
        grab = False
        for row in wb["Sources & Notes"].iter_rows(values_only=True):
            t = row[0]
            if isinstance(t, str) and t.startswith(("Conflicting", "Conflicting or")):
                grab = True
                continue
            if grab and isinstance(t, str) and t.startswith("•"):
                flags.append(t.lstrip("• ").strip())
    sources = []
    if "Sources & Notes" in wb.sheetnames:
        for row in wb["Sources & Notes"].iter_rows(min_row=3, values_only=True):
            if row[0] and row[1] and isinstance(row[0], str) and not row[0].startswith("•") and len(row[0]) <= 4:
                sources.append({"id": row[0], "title": row[1], "quality": row[4] if len(row) > 4 else None})
    out["iims"][key] = {
        "id": key,
        **META[key],
        "salaryBasis": "MEP (maximum earning potential)" if key == "ahmedabad" else "CTC as reported by the institute",
        "series": data,
        "notes": notes,
        "dataFlags": flags,
        "sources": sources,
    }

# ---- Sirmaur pilot survey (Google Forms export) ----
if SURVEY:
    ws = openpyxl.load_workbook(SURVEY, data_only=True).worksheets[0]
    rows = list(ws.iter_rows(values_only=True))
    head, rows = rows[0], [r for r in rows[1:] if any(c is not None for c in r[1:])]
    scale = {"Very poor": 1, "Poor": 2, "Neutral": 3, "Good": 4, "Excellent": 5, "Very good": 5}
    items = []
    for j in range(6, 20):
        m = re.search(r"\[(.+)\]", str(head[j]))
        vals = [scale[r[j]] for r in rows if r[j] in scale]
        if not vals:
            continue
        items.append({
            "item": m.group(1) if m else str(head[j]),
            "mean": round(statistics.mean(vals), 2),
            "n": len(vals),
            "poorShare": round(sum(v <= 2 for v in vals) / len(vals), 3),
            "goodShare": round(sum(v >= 4 for v in vals) / len(vals), 3),
        })
    items.sort(key=lambda d: d["mean"])
    rec = [r[24] for r in rows if isinstance(r[24], (int, float))]
    trade = {}
    for j in range(20, 24):
        c = collections.Counter(r[j] for r in rows if r[j])
        tot = sum(c.values())
        trade[str(head[j])] = [{"choice": k, "share": round(v / tot, 3)} for k, v in c.most_common()]
    prio = collections.Counter()
    for r in rows:
        for p in str(r[5] or "").split(", "):
            if p.strip():
                prio[p.strip()] += 1
    out["pilot"] = {
        "iim": "sirmaur",
        "n": len(rows),
        "programmes": dict(collections.Counter(r[1] for r in rows if r[1])),
        "years": dict(collections.Counter(r[2] for r in rows if r[2])),
        "ratingScale": "1 = Very poor … 5 = Excellent (mean of respondents)",
        "items": items,
        "recommend": {"n": len(rec), "mean": round(statistics.mean(rec), 2), "scale": "0-10 as entered in the form (max seen: %s)" % max(rec)},
        "tradeoffs": trade,
        "priorities": [{"item": k, "count": v} for k, v in prio.most_common()],
        "suggestions": [str(r[25]).strip() for r in rows if r[25] and len(str(r[25]).strip()) > 6 and not re.fullmatch(r"[a-z ]{1,6}", str(r[25]).strip())],
    }

os.makedirs(os.path.dirname(OUT), exist_ok=True)
with open(OUT, "w", encoding="utf-8") as f:
    json.dump(out, f, ensure_ascii=False, indent=1)
print("wrote", os.path.abspath(OUT), "iims:", len(out["iims"]))
for k, v in out["iims"].items():
    print(k.ljust(10), sorted(v["series"].keys()))
