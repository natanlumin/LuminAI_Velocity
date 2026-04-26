# LuminAI VelocityCore

A two-view dashboard for tracking R&D execution at LuminAI Security:

- **Internal view** (`/`) — sprint KPI tracker for the team. Momentum bubble plot, leg progress bars, click-to-update sliders.
- **Strategic Velocity** (`/investors.html`) — investor / board / customer view. Burn-up roadmap chart with a non-decreasing polygon per KPI (Runtime, Compliance, Advisory, Agentic AI), planned-vs-actual, milestone editor.

Light mode, local-only, single-tenant. Python (Flask) backend with JSON storage.

---

## Quickstart

Requirements: [`uv`](https://github.com/astral-sh/uv) and Python 3.14.

```bash
git clone https://github.com/natanlumin/LuminAI_Velocity
cd LuminAI_Velocity
uv sync          # install Flask + deps
uv run python app.py
```

Then open:

- **Internal:** http://localhost:5173/
- **Strategic Velocity:** http://localhost:5173/investors.html

There's a switcher in each topbar to flip between them.

---

## How to use it

### Strategic Velocity (investor view)

The chart is a non-decreasing polygon per KPI: every milestone you ship steps the line up. Two modes — `STEP` (default) and `SMOOTH` (monotone-cubic spline).

| Action | How |
|---|---|
| Ship a milestone | Click any row in the bottom milestone list. Polygon steps up, ripple ring fires at the new point. |
| Un-ship a milestone | Click the same row again. Original ship date is preserved if you re-ship later. |
| Add a new milestone | Click the `+` button at the top of any KPI column. Fill the modal: name, planned date, weight. |
| Edit / delete | Hover any milestone row, click the `⋯` icon, edit fields or hit the red `Delete` button. |
| Rewind / replay the timeline | Drag the **TODAY** scrubber. The chart redraws to show only milestones completed by that synthetic "today". |
| Switch chart mode | Click `STEP` / `SMOOTH` in the top-right toggle. |
| Isolate one KPI | Click a KPI dot in the legend below the chart. Click again to bring it back. |
| Inspect a milestone | Hover any dot on the chart for a tooltip with planned date, ship date, days early/late. |

The **velocity index** in the topbar is a weighted average of the four KPIs.

### Internal view

| Action | How |
|---|---|
| Update a block's progress | Drag the slider on any block row. Bubble glides on the momentum plot, KPI ticks live. |
| Scrub the sprint day | Drag the timeline scrubber (Day 1 → 14). Expected-pace line moves; status badges (`AHEAD` / `ON TRACK` / `DELAYED`) re-evaluate. |
| Inspect a bubble | Hover any bubble on the momentum plot. |

All slider changes persist to disk automatically (debounced 250 ms).

---

## Demo flow for a 60-second pitch

1. Open Strategic Velocity. Hit `START` on the timeline → curve flat at 0%.
2. Drag the scrubber forward to `NOW` → polygon climbs as historical milestones land.
3. Click a pending milestone (e.g. *Multi-agent monitor prototype*) → it ships at today, ripple, KPI flips to `AHEAD`.
4. Toggle `SMOOTH` mode. Same data, smoother read.

---

## Where the data lives

- `data/blocks.json` — internal sprint blocks
- `data/milestones.json` — investor roadmap milestones

These files are **gitignored** — runtime state stays out of commits. Both are auto-created on first run from seeds in `app.py`.

### Reset to seeds

```bash
rm -rf data/
uv run python app.py    # data/ is recreated from app.py defaults
```

### Bulk edit by hand

You can edit `data/milestones.json` directly when the server is stopped. Restart it to pick up your changes. Each milestone is:

```json
{
  "id": 27,
  "kpi": "agenticai",
  "name": "Multi-agent monitor prototype",
  "date": "2026-05-25",
  "completedDate": null,
  "weight": 1
}
```

`kpi` is one of `runtime` / `compliance` / `advisory` / `agenticai`. Set `completedDate` to ship a milestone, `null` to un-ship.

To shift the roadmap window, edit `ROADMAP_START` and `ROADMAP_END` at the top of `static/js/roadmap-data.js`. The slider, ticks, and chart all derive from those constants.

---

## Limitations (this is a demo)

- **No auth.** The server binds to `127.0.0.1` only. Don't expose it on a public network.
- **Single user.** No concurrency handling; if two browser tabs edit at the same time, last write wins.
- **No deployment.** Built for "founder drives, investors watch" pitches via screen-share. If you ever need a public link, we'll add basic auth + a read-only mode.
- **Sprint-day and TODAY scrubber positions are not persisted** — they're transient demo state.

---

## API reference (for future integrations)

```
GET  /api/blocks                    list internal blocks
PUT  /api/blocks/<id>               update progress / weight / blocked
GET  /api/milestones                list investor milestones
POST /api/milestones                create  (kpi, name, date, weight, completedDate?)
PUT  /api/milestones/<id>           edit any field
POST /api/milestones/<id>/ship      mark complete  (body.date optional, defaults to today)
POST /api/milestones/<id>/unship    revert; original date is remembered for re-ship
DELETE /api/milestones/<id>         delete
```
