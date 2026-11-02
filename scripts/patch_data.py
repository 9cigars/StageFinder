"""Applies verified corrections and fills to public/data/iims.json (run after extract.py).

Every override below states its source. Nothing is estimated: a value is either read from a primary filing,
read from a named public source, or left empty and flagged.

  python scripts/patch_data.py
"""
import json, os

P = os.path.join(os.path.dirname(__file__), "..", "public", "data", "iims.json")
d = json.load(open(P, encoding="utf-8"))
I = d["iims"]
Y = [str(y) for y in d["years"]]

# ---- 1. Trichy removed: its "decline" is not supported by its own NIRF filings -----------------------------------
# NIRF medians (2022-23, 2023-24, 2024-25): 18.6, 18.1, 18.0 lakh, i.e. -3% while the graduating class grew from
# 268 to 397 (+48%) and recruiters rose (172 -> 250). The workbook's 19.5 / 18.24 / 16.75 mixes news figures with a
# 2026 value that has no NIRF counterpart. A flat median on a much bigger cohort is dilution, not decline.
I.pop("trichy", None)

# ---- 2. Salary: one basis for everyone (NIRF median of placed graduates, institute-submitted) ----------------------
# 2026 placement-report figures are not yet in NIRF and use mixed bases (IIMA reports maximum earning potential),
# so they are set aside and kept under "unaudited2026" instead of being mixed into the series.
for k, v in I.items():
    s = v["series"]["salary"]
    v["unaudited2026"] = {"salary": s.get("2026")}
    s["2026"] = None

# IIM Ahmedabad: NIRF medians (2021-24 from the workbook's NIRF note; 2023-25 re-read from the 2026 NIRF filing: 31.0, 31.0, 33.0)
I["ahmedabad"]["series"]["salary"].update({"2021": 27.6, "2022": 30.0, "2023": 31.0, "2024": 31.0, "2025": 33.0})
I["ahmedabad"]["salaryBasis"] = "NIRF median of placed graduates"
I["ahmedabad"]["dataFlags"] = [
    "Salary uses NIRF medians so it is comparable with the other IIMs. IPRS 'maximum earning potential' (₹34.59 L in 2025, ₹37 L in 2026) is higher and is not used.",
    "2021 and 2022 medians (27.6, 30.0) come from the workbook's NIRF note; 2023-2025 (31.0, 31.0, 33.0) were re-read from the NIRF 2026 filing.",
]
# IIM Calcutta: read from IIM Calcutta's own NIRF filings (2024, 2025, 2026 editions)
c = I["calcutta"]["series"]
c["salary"].update({"2024": 30.0, "2025": 35.0})
c["phd"].update({"2025": 105 / 105, "2026": 91 / 92})
c["faculty"].update({"2026": 92.0})
c["women"].update({"2026": 315 / 1059})
c["intl"].update({"2026": 0.0})
I["calcutta"]["dataFlags"] = [
    "Medians 2021-2025 (27.67, 31.0, 33.67, 30.0, 35.0) match IIM Calcutta's NIRF filings. The workbook had 2024 blank and 2025 as 34.0; NIRF gives 30.0 and 35.0.",
    "News sites attribute ₹33.67 L to both 2023 and 2024; the NIRF filing assigns it to the 2022-23 batch (graduating 2023).",
    "PhD share is from the NIRF 2025 (105 of 105 listed faculty) and 2026 (91 of 92) filings.",
]
# IIM Sambalpur 2021: NIRF 2024 filing, 2020-21 graduates, ₹10,35,000
I["sambalpur"]["series"]["salary"]["2021"] = 10.35

# Cross-check notes where a NIRF filing was available
I["sirmaur"]["dataFlags"] = [
    "Medians 2021-2025 (10.0, 11.4, 12.61, 12.98, 14.2) match IIM Sirmaur's NIRF filings exactly.",
    "Faculty counts swing between NIRF editions (62, 66, 34, 52, 55, 56) because the filing rules changed; students per faculty is shown for context only and is not scored.",
    "The 2026 placement report is not out yet, so 2025 is the latest verified year.",
]
I["shillong"]["dataFlags"] = ["Medians 2021-2025 match IIM Shillong's NIRF filings (22.28, 26.09, 25.67, 25.0)."]
I["jammu"]["dataFlags"] = ["2021-2022 medians (10.0, 12.75) match the NIRF filing; 2023-2025 come from institute placement reports and were not cross-checked against NIRF."]
I["sambalpur"]["dataFlags"] = ["2021-2023 medians (10.35, 12.42, 16.0) match the NIRF filings; 2024-2025 come from placement reports and were not cross-checked. Recruiter count is from 2024 only."]
I["ranchi"]["dataFlags"] = ["Medians come from institute placement reports and were not cross-checked against NIRF (the NIRF files were not reachable)."]
I["bangalore"]["dataFlags"] = ["Medians come from IIM Bangalore placement reports and were not cross-checked against NIRF (the NIRF files were not reachable)."]

# ---- 3. ROI: current programme fee vs latest median (same definition for every IIM) --------------------------------
# Source: MBAUniverse, "IIM fees for MBA" (total programme fee, secondary source, retrieved Nov 2026).
FEES = {
    "ahmedabad": (27.50, "2025-27", "Matches the workbook's fee note (₹27.5 L for 2025-27)."),
    "bangalore": (26.00, "2026-28", ""),
    "calcutta": (27.00, "2025-27", "Sources disagree (₹27 L on the fee table, ₹27.5 L in the summary, ₹31 L on one site that may include hostel); ₹27 L is the most widely reported programme fee."),
    "jammu": (22.81, "2026-28", ""),
    "ranchi": (19.20, "2025-27", "The source does not say whether this is the full two-year fee."),
    "sambalpur": (21.13, "2026-28", ""),
    "shillong": (26.18, "2024-26", "Older schedule: the newest published fee may be higher."),
    "sirmaur": (21.00, "2026-28", "Matches the workbook (about ₹20-21 L)."),
}
for k, (fee, batch, note) in FEES.items():
    I[k]["fee"] = {"lakh": fee, "batch": batch, "note": note, "source": "MBAUniverse, IIM fees for MBA (secondary)"}
    I[k]["series"].pop("payback", None)

# ---- 4. Research: journal articles per year from OpenAlex, same query for every IIM ------------------------------
# Query: works of type 'article' whose affiliation text contains the full institute name ("Indian Institute of
# Management <city>"), by publication year. A lower bound (affiliation spelling varies) but one basis for all.
ART = {
    "ahmedabad": [131, 148, 177, 131, 108], "bangalore": [93, 121, 103, 107, 102], "calcutta": [63, 64, 64, 58, 62],
    "jammu": [23, 55, 68, 60, 51], "ranchi": [104, 136, 130, 121, 108], "sambalpur": [17, 18, 37, 72, 88],
    "shillong": [53, 64, 48, 53, 48], "sirmaur": [32, 50, 51, 43, 31],
}
for k, arr in ART.items():
    I[k]["series"]["articles"] = {str(2021 + i): float(n) for i, n in enumerate(arr)}
    I[k]["series"].pop("articlesPerFaculty", None)

# ---- 5. Sources + method ------------------------------------------------------------------------------------------
d["method"] = {
    "commonYear": 2025,
    "salary": "NIRF median of placed graduates (institute-submitted), batch graduating in the year shown",
    "roi": "Current programme fee ÷ latest median salary × 12 (gross months, before tax and living costs)",
    "faculty": "Share of faculty listed in NIRF with a Ph.D., latest edition",
    "research": "Journal articles per listed faculty: 2023-2025 average of OpenAlex articles ÷ latest NIRF faculty count",
    "diversity": "Women share of PG students (70%) and international share (30%), latest NIRF edition",
    "removed": {"trichy": "Removed: its NIRF median is flat (₹18.6 L, ₹18.1 L, ₹18.0 L for 2023-25) while the class grew 48% and recruiters rose, so there is no evidence of decline."},
}
for k, v in I.items():
    v["sources"] = v.get("sources", []) + [
        {"id": "OA", "title": "OpenAlex works API: journal articles by affiliation text, 2021-2025", "quality": "Open scholarly index; lower bound"},
        {"id": "FEE", "title": "MBAUniverse: IIM fees for MBA (current-batch total programme fee)", "quality": "Secondary"},
    ]
json.dump(d, open(P, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("patched:", ", ".join(I))
