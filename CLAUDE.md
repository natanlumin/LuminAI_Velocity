# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

LuminAI VelocityCore: a single-process Flask app that serves two independent vanilla-JS dashboards for tracking R&D execution. It's a demo/pitch tool — local-only, single-tenant, no auth, no build step.

- **Internal view** (`/` → `index.html`) — sprint KPI tracker. Momentum bubble plot, leg score bars, per-block progress sliders.
- **Strategic Velocity** (`/investors.html`) — investor/board view. Burn-up roadmap chart (non-decreasing polygon per KPI), milestone ship/un-ship/edit, a draggable synthetic "TODAY" scrubber.

## Commands

```bash
uv sync                    # install Flask (requires uv + Python >=3.14)
uv run python app.py       # serve both views on http://127.0.0.1:5173
```

- Internal: http://localhost:5173/ · Strategic Velocity: http://localhost:5173/investors.html
- Flask runs in `debug=True`, so Python edits hot-reload. There is **no build/bundler** — edit JS/CSS/HTML and refresh the browser.
- There are **no tests and no linter** configured.
- `main.py` is a leftover PyCharm "Hi, PyCharm" stub — **not** the entrypoint. The app entrypoint is `app.py`.

### Resetting / editing data

```bash
rm -rf data/ && uv run python app.py   # recreate data/*.json from seeds in app.py
```

`data/*.json` is gitignored runtime state. To bulk-edit, stop the server, edit `data/milestones.json` or `data/blocks.json`, restart.

## Architecture

**Backend (`app.py`)** — one Flask file. Serves the two HTML pages + `/static`, and a JSON API. State persists to `data/blocks.json` and `data/milestones.json`, written atomically (`*.tmp` + `replace`) under a single global `Lock`. On first run the files are seeded from `SEED_BLOCKS` / `SEED_MILESTONES` embedded in `app.py` (these are the **authoritative** seeds). The catch-all `asset()` route refuses to serve `data/`, `app.py`, `pyproject.toml`, `uv.lock`.

API surface:
```
GET    /api/blocks                 PUT /api/blocks/<id>            (progress, weight, blocked, name, description)
GET    /api/milestones             POST /api/milestones            PUT /api/milestones/<id>
POST   /api/milestones/<id>/ship   POST /api/milestones/<id>/unship   DELETE /api/milestones/<id>
```

**Frontend** — no framework. Each page loads ordered `<script>` tags; modules communicate through globals (no imports/bundler). Canvas renderers are IIFE singletons exposing a small method set:
- Internal: `data.js` (globals `BLOCKS`, `LEG_WEIGHTS`, `LEG_COLORS`, sprint state) → `kpi.js` (pure scoring fns) → `momentum.js` (`Momentum` canvas module) → `app.js` (DOM render + wiring).
- Investor: `roadmap-data.js` (globals `MILESTONES`, KPI constants, `ROADMAP_START/END`, `TODAY_DATE`, `CHART_MODE`) → `burnup.js` (`Burnup` canvas module, incl. `buildSeries(kpi)`) → `investors-app.js` (DOM render + modal + wiring).
- `static/css/main.css` is shared; `investors.css` layers on for the investor page.

Both `app.js` and `investors-app.js` fetch their data from the API at `init()` and mutate the global array in place (`MILESTONES.length = 0; MILESTONES.push(...)`) so renderers keep their reference.

## Conventions and gotchas

- **Seed data is duplicated.** The real seeds live in `app.py` (`SEED_BLOCKS` / `SEED_MILESTONES`, written to disk). `data.js` (`_BLOCKS_SEED`) and `roadmap-data.js` (`_MILESTONES_SEED`) carry copies marked "static fallback / reference only" — they are **not** loaded at runtime. If you change a seed, update `app.py`; keep the JS copies in sync only if you care about the reference.
- **Roadmap geometry is data-driven.** `ROADMAP_START` / `ROADMAP_END` in `roadmap-data.js` drive the slider range, month ticks, and every chart x-coordinate. Change those constants, not downstream pixel math.
- **Ship-date semantics** (`toggleMilestone` in `investors-app.js`): shipping a milestone whose planned `date` is in the past lands it at the planned date (backfilling history); a future-planned milestone ships at the current TODAY scrubber position (shipped early). Override either via the edit modal's "Shipped On" field.
- **Un-ship preserves the original date.** The backend stashes `completedDate` into a `_savedDate` field on un-ship and restores it on re-ship instead of stamping today.
- **KPI weighting:** internal velocity = leg scores weighted by `LEG_WEIGHTS` in `data.js`. Investor velocity index = per-KPI actual%, weighted by each KPI's total milestone weight. Status thresholds: internal `statusFor` uses ±10 vs expected pace; investor `compareStatus` uses ±8 actual-vs-planned.
- The sprint-day and TODAY scrubber positions are transient demo state — **not** persisted.
- All user-facing strings are run through `escapeHtml` / `escapeHtmlInv` before injection into `innerHTML`.
