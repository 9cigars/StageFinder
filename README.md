# IIM Stage Finder

Pick an IIM, answer 10 questions, and see which product-life-cycle stage the institute is in, its strengths and weaknesses, and its biggest bottlenecks. The result blends public data (your 9 workbooks) with the student's answers. The page re-themes for each IIM.

## Run it

```bash
node server.js          # needs Node 22.5+; no npm install
```

Open http://localhost:3000. Share a link that opens a specific IIM with its theme: `http://localhost:3000/?iim=sirmaur`.

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

## Rebuild the data after editing a workbook

```bash
pip install openpyxl
python scripts/extract.py "<folder with IIM_*_Metrics_2021-2026.xlsx>" "<survey .xlsx>"
```

## The ten questions (edit them in `public/js/questions.js`)

**Part A: read the stage (5 questions).** Reputation, recruiters, processes, faculty, salary direction. Each option votes for Introduction, Growth, Maturity or Decline. The votes are compared with the stage the data gives.

**Part B: find the bottleneck (5 questions, one per metric).** A 1-5 rating (feeds strengths and weaknesses) followed by up to two specific causes. Some causes ask for a detail: which sector is missing from recruiters, which department lacks faculty, which cost hurts, which research resource is weak.

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
