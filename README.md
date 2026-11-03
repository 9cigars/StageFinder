# StageFinder

**Where does your IIM stand in its life cycle?** Answer 10 questions to see which stage your IIM is in (Introduction, Growth, Maturity or Decline), what it does well, and exactly what is holding it back. Your answers are set against public NIRF and placement data for 2021-2026, and the page re-themes for each institute.

**Live site:** https://9cigars.github.io/StageFinder/

Built for the IIM Sirmaur Operations Management project (Product Life Cycle Analysis). It covers eight IIMs: Sirmaur, Ahmedabad, Bangalore, Calcutta, Jammu, Ranchi, Sambalpur and Shillong, with IIM Ahmedabad, Bangalore and Calcutta as the benchmark.

## What it does

1. The student picks their IIM and answers ten questions: five read the stage from things they can see, five find the bottleneck on each of five metrics (salary, ROI, PhD faculty, research, diversity).
2. The answers are compared with the public data.
3. The result shows the stage, where students and the data agree or disagree, strengths and weaknesses, and the bottlenecks to fix first, with the specific causes named.

## Run it

```bash
node server.js          # needs Node 22.5+; no npm install
```

Open http://localhost:3000 (set `window.IIM_API_BASE = ''` in `public/config.js` to collect responses on this server). Share a link that opens a specific IIM with its theme: `http://localhost:3000/?iim=sirmaur`. On the live site: `https://9cigars.github.io/StageFinder/?iim=sirmaur`.

## What is where

| Path | Purpose |
|---|---|
| `public/data/iims.json` | All 9 IIMs' series (2021-26) and the Sirmaur pilot survey. Built by `scripts/extract.py`. |
| `public/js/questions.js` | The 5 metrics, the 10 questions and the bottleneck causes. Edit questions here. |
| `public/js/engine.js` | Scoring, stage rules, thresholds (`THRESHOLDS`, `BLEND`). Pure functions. |
| `public/js/themes.js` | One palette and one drawn motif per IIM. |
| `public/js/app.js` | The interface. |
| `server.js` | Static hosting + anonymous response API on SQLite. |
| `data/responses.db` | Created on first response (git-ignored). |

## Diagnosis and playbooks

Every result page opens with **the problems in the institute's own numbers**, ranked by severity against the IIM A/B/C average and the other IIMs (`public/js/diagnose.js`): pay level, fee payback, slowing growth, thin recruiter base, research per faculty, faculty capacity, international students, women's share.

Each problem points to a **playbook** in `public/data/playbooks.json`: leading IIMs, peer IIMs and global business schools that faced the same problem, with the age they were at, what is documented that they did, the result, and the source. The page ranks them by stage match, comparing the school's age then with the viewing IIM's age and stage. If no documented case is at the viewer's stage (for example a mature school), it says so instead of forcing a match. Cards say when a source gives a result but not the method.

Current playbooks (39 sourced cases): global credibility (ISB, CEIBS, IIM Kozhikode, IIM Indore, and peers Shillong, Ranchi, Sambalpur), research base (HKUST, SMU, ISB, early IIM Ahmedabad, and established schools Haskayne and Boston College), faculty scale-up, international exposure (HKUST, CEIBS, ISB, IIM Ahmedabad's exchange network, INSEAD), women's share (including Harvard Business School), sustaining growth (ISB, HKUST, CEIBS, and IIM Ahmedabad and Bangalore's moves beyond the MBA), and rebuilding the recruiter base (Olin, and peer IIMs).

## Solutions library

`public/data/solutions.json` holds 56 documented cases, each tied to one or more of the 30 causes students can name. A case records the institute, what it did, the source link and an evidence label (Official, Report, Dataset, News, Secondary). A case is marked "Result only" when the outcome is public but the method is not. Where nothing is documented for a cause, the library says so in `gaps` instead of inventing a fix.

For every cause a student names, the result page shows:
1. **A data check**: whether the institute's own figures support the cause (for example, a student blaming "too few recruiters" at a campus with more recruiters than IIM A/B/C is told the data does not back it).
2. **What comparable institutes did**: up to four cases, ordered by how well they match the chosen detail (sector, department, cost), peer type and source strength.
3. **What is not documented**, so gaps stay visible.

Add a case by appending to `cases` in `solutions.json` with a real source; the matching code in `public/js/solutions.js` picks it up.

## Data and how it is measured

Every IIM has a value for each of the five metrics, measured the same way:

| Metric | Measure | Source |
|---|---|---|
| Salary | NIRF median of placed graduates, 2025 batch, vs the IIM A/B/C average | NIRF filings, placement reports |
| ROI | Current programme fee ÷ latest median × 12 (gross months) | MBAUniverse fee table (secondary) |
| Faculty with PhDs | Share of NIRF-listed faculty with a Ph.D. | NIRF filings |
| Research | 2023-25 average journal articles ÷ NIRF faculty count | OpenAlex works API (full institute name) |
| Diversity | 70% women share + 30% international share of PG students | NIRF filings |

Corrections made to the workbooks are listed, with sources, in `scripts/patch_data.py`: Calcutta 2024 and 2025 medians and PhD share (IIM Calcutta's own NIRF filings), Ahmedabad moved from maximum earning potential to the NIRF median, Sambalpur 2021, and 2026 placement-report figures set aside because they are not yet in NIRF.

## Rebuild the data after editing a workbook

```bash
pip install openpyxl
python scripts/extract.py "<folder with IIM_*_Metrics_2021-2026.xlsx>" "<survey .xlsx>"
python scripts/patch_data.py
```

## The ten questions (edit them in `public/js/questions.js`)

**Part A: read the stage (5 questions).** Reputation, recruiters, processes, faculty, salary direction. Each option votes for Introduction, Growth, Maturity or Decline. The votes are compared with the stage the data gives.

**Part B: find the bottleneck (5 questions, one per metric).** A 1-5 rating (feeds strengths and weaknesses) followed by up to two specific causes. Some causes ask for a detail: which sector is missing from recruiters, which department lacks faculty, which cost hurts, which research resource is weak.

## Presentation mode

The home page has a **Presentation mode** button (or open `?demo=1`). It is a seven-scene, three-minute walkthrough that follows the closing script (what it is, the five metrics, the data and benchmark, the stage rule, the student view, a live demo, the close with a QR code). Every number on a slide is the number in the engine. Keys: `→` / `Space` next, `←` back, `A` auto-play on the script timing, `N` speaker notes, `F` fullscreen, `R` reset, `Esc` exit. The code is in `public/js/demo.js`.

**Guided demo.** The last-but-one slide has a **Run the live demo** button (or open `?guided=1`, or press `G` on the home page). It fills in the real quiz for IIM Sirmaur by clicking the real buttons, one step per key press (`→`), with `A` for auto-play, `N` to show the spoken line and `Esc` to stop. It then walks down the result page. Nothing is sent to the server while it runs. The code is in `public/js/guided.js`.

## Look and feel

Each IIM has its own palette, an animated scene and a particle effect that reacts to the cursor (embers, network, rain, snow, leaves, ripples, mist, petals, lanterns). Choosing an IIM plays a colour wipe from the click point. The quiz has a live curve and radar that update as you answer. Motion is switched off for users who prefer reduced motion.

## How the stage is decided (from `engine.js`)

Salary is compared with the IIM A/B/C average for the same year.
- below 70%: **Growth** (momentum "catching up" or "stalling" from growth vs A/B/C)
- 70-85%: **Maturity** if recent growth is below A/B/C's, otherwise late **Growth**
- 85% or more: **Maturity**
- a fall of more than 3% over about 3 years: **Decline**

Student answers cross-check the stage; they do not change it. Bottlenecks are the metrics scoring below 65 that public data backs up; weak spots only students raised are shown separately.

Metric scores: salary, PhD share, payback and research are each compared with the A/B/C figure; diversity is 70% women share + 30% international share. Blended score = 60% data + 40% student rating, or whichever side exists.

## Backend

| Endpoint | What it does |
|---|---|
| `POST /api/responses` | Stores one row per IIM and device (re-submitting updates it). Validated, 16 KB cap, rate-limited. |
| `GET /api/aggregate/:iim` | Combined view (stage votes, rating means, named causes and details); only appears at 5+ responses. |
| `GET /api/stats` | Responses per IIM. |
| `GET /api/export.csv?key=...` | Full export, only if `ADMIN_KEY` is set. |

Environment: `PORT`, `DB_PATH`, `ADMIN_KEY`, `ALLOW_ORIGIN`, `TRUST_PROXY=1`.

No names, emails or IP addresses are stored. The optional comment is stored but never shown on the site; it appears only in the admin export.

## Putting it online for students

The backend needs a host that runs Node and keeps a disk (Render, Railway or Fly.io; mount a volume at `data/`). Set `ADMIN_KEY` there. If you host only `public/` on GitHub Pages, set `window.IIM_API_BASE` in `public/config.js` to the backend's URL and set `ALLOW_ORIGIN` on it; with `null`, everything still works but results stay on each student's device.

## Known data gaps

ROI (fees) and research output exist for only a few IIMs, so those bars show "n/a" and the student view stands alone. Calcutta has no PhD share. IIM Ahmedabad's salary is maximum earning potential, not CTC. See the data-quality section on each result page.
